import { JUDGE0_TIMEOUT_MS, JUDGE0_URL } from "../config/judge0";
import { logger } from "./logger";

export type SupportedLanguageKey =
  | "python"
  | "cpp"
  | "c";

export const JUDGE0_LANGUAGE_IDS = {
  C: 50,
  CPP: 54,
  PYTHON: 71,
} as const;

export const FALLBACK_JUDGE0_LANGUAGE_IDS: Record<SupportedLanguageKey, number> = {
  python: JUDGE0_LANGUAGE_IDS.PYTHON,
  cpp: JUDGE0_LANGUAGE_IDS.CPP,
  c: JUDGE0_LANGUAGE_IDS.C,
};

interface Judge0Language {
  id: number;
  name: string;
}

interface CacheEntry {
  expiresAt: number;
  map: Record<SupportedLanguageKey, number>;
  fetchedAt: string;
  source: "live" | "fallback";
}

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: CacheEntry | null = null;
let inFlight: Promise<CacheEntry> | null = null;

const LANGUAGE_MATCHERS: Record<SupportedLanguageKey, RegExp[]> = {
  python: [
    /\bpython\b/i,
    /\bpython3\b/i,
  ],

  cpp: [
    /\bc\+\+\b/i,
    /\bg\+\+\b/i,
    /\bgcc.*c\+\+/i
  ],

  c: [
    /\bc\b(?!\+\+)/i, // prevents matching C++
    /\bgcc\b(?!.*c\+\+)/i
  ],
};

function findBestLanguageMatch(languages: Judge0Language[], key: SupportedLanguageKey): Judge0Language | null {
  const matchers = LANGUAGE_MATCHERS[key];
  const matches = languages.filter((language) => matchers.some((matcher) => matcher.test(language.name)));

  if (matches.length === 0) {
    return null;
  }

  const preferredId = FALLBACK_JUDGE0_LANGUAGE_IDS[key];
  return matches.find((language) => language.id === preferredId) ?? matches[0];
}

async function fetchLanguages(): Promise<Judge0Language[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JUDGE0_TIMEOUT_MS);

  try {
    const response = await fetch(`${JUDGE0_URL}/languages`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Judge0 /languages failed: ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) {
      throw new Error("Judge0 /languages response is not an array");
    }

    const normalized = body
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const id = (item as { id?: unknown }).id;
        const name = (item as { name?: unknown }).name;
        if (!Number.isInteger(id) || typeof name !== "string") return null;
        return { id, name } as Judge0Language;
      })
      .filter((item): item is Judge0Language => item !== null);

    return normalized;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadLanguageMap(): Promise<CacheEntry> {
  try {
    const languages = await fetchLanguages();
    const mapped: Record<SupportedLanguageKey, number> = { ...FALLBACK_JUDGE0_LANGUAGE_IDS };
    const matchedNames: Partial<Record<SupportedLanguageKey, string>> = {};
    const preferredUnavailable: Partial<Record<SupportedLanguageKey, { preferredId: number; selectedId: number; selectedName: string }>> = {};

    for (const key of Object.keys(mapped) as SupportedLanguageKey[]) {
      const matchedLanguage = findBestLanguageMatch(languages, key);

      if (matchedLanguage) {
        mapped[key] = matchedLanguage.id;
        matchedNames[key] = matchedLanguage.name;

        const preferredId = FALLBACK_JUDGE0_LANGUAGE_IDS[key];
        if (matchedLanguage.id !== preferredId) {
          preferredUnavailable[key] = {
            preferredId,
            selectedId: matchedLanguage.id,
            selectedName: matchedLanguage.name,
          };
        }
      } else {
        logger.warn(
          { key, fallbackId: FALLBACK_JUDGE0_LANGUAGE_IDS[key] },
          "Judge0 language not found in live /languages payload, using fallback ID"
        );
      }
    }

    if (Object.keys(preferredUnavailable).length > 0) {
      logger.warn(
        { preferredUnavailable },
        "Preferred Judge0 language IDs were not present in live catalog; using closest available matches"
      );
    }

    logger.info(
      {
        discovered: languages.length,
        mapped,
        matchedNames,
      },
      "Judge0 language map loaded"
    );

    return {
      map: mapped,
      fetchedAt: new Date().toISOString(),
      expiresAt: Date.now() + CACHE_TTL_MS,
      source: "live",
    };
  } catch (error) {
    logger.warn(
      {
        error,
        fallback: FALLBACK_JUDGE0_LANGUAGE_IDS,
      },
      "Judge0 language discovery failed, using fallback IDs"
    );

    return {
      map: { ...FALLBACK_JUDGE0_LANGUAGE_IDS },
      fetchedAt: new Date().toISOString(),
      expiresAt: Date.now() + CACHE_TTL_MS,
      source: "fallback",
    };
  }
}

export async function getJudge0LanguageMap(forceRefresh = false): Promise<CacheEntry> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) {
    return cache;
  }

  if (!inFlight || forceRefresh) {
    inFlight = loadLanguageMap().then((entry) => {
      cache = entry;
      return entry;
    });
  }

  return inFlight;
}

export async function getJudge0LanguageId(language: string): Promise<number | null> {
  const key = language as SupportedLanguageKey;
  if (!(key in FALLBACK_JUDGE0_LANGUAGE_IDS)) {
    return null;
  }

  const mapEntry = await getJudge0LanguageMap();
  return mapEntry.map[key];
}
