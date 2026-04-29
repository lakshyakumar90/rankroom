import cron from "node-cron";
import { prisma, type Prisma } from "@repo/database";
import { AppError } from "../middleware/error";
import { normalizeGitHubUsername, normalizeLeetCodeUsername } from "../lib/platform-usernames";
import { fetchGitHubOfficialContributionHeatmap } from "../lib/github-contributions-graphql";
import { outboundJson, outboundText } from "../lib/outbound-fetch";
import { logger } from "../lib/logger";
import { ensureStudentProfile } from "../services/student-profile.service";
import { computeStreakFromHeatmap } from "../services/streak.service";
import { recomputeStudentIntelligence } from "../services/student-intelligence.service";

const LEETCODE_GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";
const LEETCODE_CN_GRAPHQL_ENDPOINT = "https://leetcode.cn/graphql";
const GITHUB_CONTRIBUTIONS_ENDPOINT = "https://github-contributions-api.jogruber.de/v4";
const GITHUB_CONTRIBUTIONS_FALLBACK_ENDPOINT = "https://github-contributions-api.deno.dev";

const LEETCODE_QUERY = `
  query userCalendarAndStats($username: String!) {
    matchedUser(username: $username) {
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
      userCalendar {
        submissionCalendar
      }
    }
  }
`;

type PlatformSyncTarget = "leetcode" | "github" | "codechef" | "codeforces" | "all";
type Heatmap = Record<string, number>;

type SyncPayload = {
  updates: Prisma.StudentProfileUpdateInput;
  heatmap: Heatmap;
};

/** LeetCode calendars are anchored to Pacific time (their web UI); UTC dates misalign submissions. */
const LEETCODE_HEATMAP_TZ = "America/Los_Angeles";

function leetCodeDayKeyFromUnixSeconds(sec: number): string {
  if (!Number.isFinite(sec)) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LEETCODE_HEATMAP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(sec * 1000));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : "";
}

function mergeHeatmaps(...heatmaps: Heatmap[]) {
  const merged: Heatmap = {};
  for (const heatmap of heatmaps) {
    for (const [date, count] of Object.entries(heatmap)) {
      merged[date] = (merged[date] ?? 0) + count;
    }
  }
  return merged;
}

function utcDayKeyFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseContributionCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

/** Prefer lib/outbound-fetch (User-Agent etc.) — kept as alias so existing callers stay readable. */
const safeJson = outboundJson;
const safeText = outboundText;

function sumGithubYearlyTotalsFromPayload(payload: Record<string, unknown> | null | undefined): number {
  const raw = payload?.["total"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  return Object.values(raw as Record<string, unknown>).reduce<number>(
    (sum, value) => sum + parseContributionCount(value),
    0
  );
}

function parseLeetCodeCalendar(rawCalendar: string | null | undefined) {
  if (!rawCalendar) return {};

  try {
    const parsed = JSON.parse(rawCalendar) as Record<string, number>;
    const out: Record<string, number> = {};
    for (const [timestamp, count] of Object.entries(parsed)) {
      const sec = Number.parseInt(String(timestamp), 10);
      if (!Number.isFinite(sec)) continue;
      const key = leetCodeDayKeyFromUnixSeconds(sec);
      if (!key) continue;
      const n = typeof count === "number" && Number.isFinite(count) ? count : 0;
      out[key] = (out[key] ?? 0) + n;
    }
    return out;
  } catch {
    return {};
  }
}

const LEETCODE_BROWSER_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://leetcode.com",
  Referer: "https://leetcode.com/",
} as const;

async function syncLeetCode(username: string): Promise<SyncPayload> {
  const handle = normalizeLeetCodeUsername(username);
  if (!handle) {
    throw new Error("LeetCode username is empty");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await syncLeetCodeGraphQlOnce(handle);
    } catch (error: unknown) {
      lastError = error;
      logger.warn({ handle, attempt, error: String(error) }, "LeetCode sync attempt failed");
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function syncLeetCodeGraphQlOnce(handle: string): Promise<SyncPayload> {
  type LeetCodeResponse = {
    data?: {
      matchedUser?: {
        submitStatsGlobal?: {
          acSubmissionNum?: Array<{ difficulty: string; count: number }>;
        };
        submitStats?: {
          acSubmissionNum?: Array<{ difficulty: string; count: number }>;
        };
        userCalendar?: {
          submissionCalendar?: string;
        };
      } | null;
    };
    errors?: Array<{ message?: string }>;
  };

  const post = (endpoint: string) =>
    safeJson<LeetCodeResponse>(endpoint, {
      method: "POST",
      headers:
        endpoint.includes("leetcode.cn")
          ? {
              ...LEETCODE_BROWSER_HEADERS,
              Origin: "https://leetcode.cn",
              Referer: "https://leetcode.cn/",
            }
          : LEETCODE_BROWSER_HEADERS,
      body: JSON.stringify({
        query: LEETCODE_QUERY,
        variables: { username: handle },
      }),
    });

  let response: LeetCodeResponse;
  try {
    response = await post(LEETCODE_GRAPHQL_ENDPOINT);
  } catch (error: unknown) {
    response = {
      errors: [{ message: error instanceof Error ? error.message : "LeetCode.com request failed" }],
    };
  }

  if (!response.data?.matchedUser) {
    try {
      response = await post(LEETCODE_CN_GRAPHQL_ENDPOINT);
    } catch {
      // keep previous errors / empty
    }
  }

  if (response.errors?.length && !response.data?.matchedUser) {
    const msg = response.errors.map((e) => e.message).filter(Boolean).join("; ") || "LeetCode GraphQL error";
    logger.warn({ handle, errors: response.errors }, "LeetCode GraphQL reported errors");
    throw new Error(msg);
  }

  if (!response.data?.matchedUser) {
    throw new Error(`LeetCode user '${handle}' not found`);
  }

  const stats =
    response.data.matchedUser.submitStatsGlobal?.acSubmissionNum ??
    response.data.matchedUser.submitStats?.acSubmissionNum ??
    [];
  const solvedByDifficulty = new Map(
    stats.map((entry) => [String(entry.difficulty ?? "").toUpperCase(), Math.max(0, entry.count ?? 0)])
  );

  let leetcodeSolved = solvedByDifficulty.get("ALL") ?? 0;
  if (leetcodeSolved === 0) {
    leetcodeSolved =
      (solvedByDifficulty.get("EASY") ?? 0) +
      (solvedByDifficulty.get("MEDIUM") ?? 0) +
      (solvedByDifficulty.get("HARD") ?? 0);
  }

  const heatmap = parseLeetCodeCalendar(response.data.matchedUser.userCalendar?.submissionCalendar);

  return {
    updates: {
      leetcodeSolved,
      leetcodeEasy: solvedByDifficulty.get("EASY") ?? 0,
      leetcodeMedium: solvedByDifficulty.get("MEDIUM") ?? 0,
      leetcodeHard: solvedByDifficulty.get("HARD") ?? 0,
    },
    heatmap,
  };
}

function parseGitHubContributionCalendar(payload: Record<string, unknown>) {
  const heatmap: Heatmap = {};
  let total = 0;

  const directContributions = Array.isArray(payload["contributions"])
    ? (payload["contributions"] as Array<Record<string, unknown>>)
    : [];

  for (const item of directContributions) {
    const date = typeof item["date"] === "string" ? item["date"] : null;
    const count = parseContributionCount(item["count"] ?? item["contributionCount"]);
    if (date) {
      heatmap[date] = (heatmap[date] ?? 0) + count;
      total += count;
    }
  }

  const calendar = payload["contributionCalendar"];
  const weeks = calendar && typeof calendar === "object" && Array.isArray((calendar as { weeks?: unknown[] }).weeks)
    ? ((calendar as { weeks: Array<{ contributionDays?: Array<Record<string, unknown>> }> }).weeks ?? [])
    : [];

  for (const week of weeks) {
    for (const day of week.contributionDays ?? []) {
      const date = typeof day["date"] === "string" ? day["date"] : null;
      const count = parseContributionCount(day["contributionCount"] ?? day["count"]);
      if (date) {
        heatmap[date] = Math.max(heatmap[date] ?? 0, count);
      }
    }
  }

  total =
    total ||
    (parseContributionCount(payload["totalContributions"]) ||
      parseContributionCount(payload["total"]) ||
      parseContributionCount(payload["contributionCount"]) ||
      parseContributionCount(payload["contributionsCount"]) ||
      Object.values(heatmap).reduce((sum, value) => sum + value, 0));

  return { total, heatmap };
}

function parseFallbackGitHubContributionCalendar(payload: Record<string, unknown> | null) {
  const heatmap: Heatmap = {};
  if (!payload) return { total: 0, heatmap };

  const weeks = Array.isArray(payload["contributions"])
    ? (payload["contributions"] as Array<unknown>)
    : [];

  for (const week of weeks) {
    if (!Array.isArray(week)) continue;
    for (const day of week) {
      if (!day || typeof day !== "object") continue;
      const item = day as Record<string, unknown>;
      const date = typeof item["date"] === "string" ? item["date"] : null;
      const count = parseContributionCount(item["contributionCount"] ?? item["count"]);
      if (date) {
        heatmap[date] = (heatmap[date] ?? 0) + count;
      }
    }
  }

  const total =
    parseContributionCount(payload["totalContributions"]) ||
    parseContributionCount(payload["total"]) ||
    Object.values(heatmap).reduce((sum, value) => sum + value, 0);

  return { total, heatmap };
}

async function syncGitHub(username: string): Promise<SyncPayload> {
  const login = normalizeGitHubUsername(username);
  if (!login) {
    throw new Error("GitHub username is empty");
  }

  const official = await fetchGitHubOfficialContributionHeatmap(login).catch(() => null);

  const [contributionsPayload, fallbackContributionsPayload, repos] = await Promise.all([
    safeJson<Record<string, unknown>>(`${GITHUB_CONTRIBUTIONS_ENDPOINT}/${encodeURIComponent(login)}`).catch(() => null),
    safeJson<Record<string, unknown>>(`${GITHUB_CONTRIBUTIONS_FALLBACK_ENDPOINT}/${encodeURIComponent(login)}.json`).catch(
      () => null
    ),
    safeJson<Array<{ language: string | null }>>(`https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&sort=updated`).catch(
      () => []
    ),
  ]);

  const primary = parseGitHubContributionCalendar(contributionsPayload ?? {});
  const fallback = parseFallbackGitHubContributionCalendar(fallbackContributionsPayload);

  const thirdPartyHeatmap = mergeHeatmaps(primary.heatmap, fallback.heatmap);
  const useOfficial = Boolean(official?.heatmap && Object.keys(official.heatmap).length > 0);
  const heatmap = useOfficial ? { ...official!.heatmap } : thirdPartyHeatmap;

  const heatmapSum = Object.values(heatmap).reduce((sum, value) => sum + value, 0);
  const yearlyFromApi = useOfficial
    ? 0
    : sumGithubYearlyTotalsFromPayload(contributionsPayload ?? undefined) ||
      sumGithubYearlyTotalsFromPayload(fallbackContributionsPayload ?? undefined);
  const total =
    heatmapSum ||
    (useOfficial ? (official?.total ?? 0) : 0) ||
    yearlyFromApi ||
    primary.total ||
    fallback.total ||
    0;

  if (heatmapSum === 0 && yearlyFromApi > 0) {
    logger.warn({ login, yearlyFromApi }, "GitHub daily heatmap empty but yearly total present; check upstream API / network");
  }
  if (heatmapSum > 0 && heatmapSum < yearlyFromApi && yearlyFromApi > 200) {
    logger.warn({ login, heatmapSum, yearlyFromApi }, "GitHub contrib heatmap may be incomplete vs lifetime total");
  }

  if (useOfficial) {
    logger.info({ login, heatmapDays: Object.keys(heatmap).length, heatmapSum }, "GitHub contributions from official GraphQL API");
  }

  const languageCounts = repos.reduce<Record<string, number>>((accumulator, repo) => {
    if (repo.language) {
      accumulator[repo.language] = (accumulator[repo.language] ?? 0) + 1;
    }
    return accumulator;
  }, {});

  const githubTopLanguages = Object.entries(languageCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    updates: {
      githubContributions: total,
      githubTopLanguages,
    },
    heatmap,
  };
}

async function syncCodeforces(username: string): Promise<SyncPayload> {
  type CodeforcesResponse = {
    status: string;
    result?: Array<{
      rating?: number;
      maxRating?: number;
      rank?: string;
    }>;
  };

  const response = await safeJson<CodeforcesResponse>(
    `https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`
  );

  const user = response.result?.[0];
  if (!user) {
    throw new Error("Codeforces profile not found");
  }

  return {
    updates: {
      codeforcesRating: user.rating ?? null,
      codeforcesMaxRating: user.maxRating ?? null,
      codeforcesRank: user.rank ?? null,
    },
    heatmap: {},
  };
}

function extractFirstNumber(patterns: RegExp[], input: string) {
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10);
    }
  }
  return null;
}

async function syncCodeChef(username: string): Promise<SyncPayload> {
  const html = await safeText(`https://www.codechef.com/users/${encodeURIComponent(username)}`);

  const codechefRating = extractFirstNumber(
    [/\"currentRating\"\s*:\s*(\d+)/, /rating-number[^>]*>\s*(\d+)/i],
    html
  );
  const codechefMaxRating = extractFirstNumber(
    [/\"highestRating\"\s*:\s*(\d+)/, /Highest Rating[^0-9]*(\d+)/i],
    html
  );
  const codechefStars = extractFirstNumber(
    [/\"stars\"\s*:\s*\"?(\d+)\"?/, /rating-star[^>]*>\s*([1-7])/i],
    html
  );

  return {
    updates: {
      codechefRating,
      codechefMaxRating,
      codechefStars,
    },
    heatmap: {},
  };
}

async function getInternalRankRoomActivity(userId: string): Promise<Heatmap> {
  const submissions = await prisma.submission.findMany({
    where: { userId, status: "ACCEPTED" },
    select: { createdAt: true, contestId: true },
  });

  const heatmap: Heatmap = {};
  for (const submission of submissions) {
    const date = utcDayKeyFromDate(submission.createdAt);
    heatmap[date] = (heatmap[date] ?? 0) + (submission.contestId ? 2 : 1);
  }

  return heatmap;
}

function getSelectedPlatforms(platform: PlatformSyncTarget) {
  if (platform === "all") {
    return ["leetcode", "github", "codechef", "codeforces"] as const;
  }
  return [platform] as const;
}

export async function syncStudentProfileById(
  profileId: string,
  platform: PlatformSyncTarget = "all"
) {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: {
      user: true,
      skills: true,
      projects: true,
      achievements: true,
    },
  });

  if (!profile) {
    throw new AppError("Student profile not found", 404);
  }

  const selectedPlatforms = getSelectedPlatforms(platform);
  const tasks: Array<Promise<SyncPayload>> = [];

  if (selectedPlatforms.includes("leetcode") && profile.leetcodeUsername?.trim()) {
    tasks.push(syncLeetCode(profile.leetcodeUsername.trim()));
  }
  const githubLogin =
    profile.githubUsername?.trim() || profile.user.githubUsername?.trim() || "";
  if (selectedPlatforms.includes("github") && githubLogin) {
    tasks.push(syncGitHub(githubLogin));
  }
  if (selectedPlatforms.includes("codechef") && profile.codechefUsername) {
    tasks.push(syncCodeChef(profile.codechefUsername));
  }
  if (selectedPlatforms.includes("codeforces") && profile.codeforcesUsername) {
    tasks.push(syncCodeforces(profile.codeforcesUsername));
  }

  const internalHeatmap = await getInternalRankRoomActivity(profile.userId);
  const settled = await Promise.allSettled(tasks);

  const updates: Prisma.StudentProfileUpdateInput = {};
  const heatmaps: Heatmap[] = [internalHeatmap];

  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      Object.assign(updates, result.value.updates);
      heatmaps.push(result.value.heatmap);
      return;
    }

    logger.warn({ profileId, error: String(result.reason) }, "Platform sync task failed");
  });

  const mergedHeatmap = mergeHeatmaps(...heatmaps);
  const streakSummary = computeStreakFromHeatmap(mergedHeatmap);

  logger.info(
    {
      profileId,
      mergedHeatmapDays: Object.keys(mergedHeatmap).length,
      mergedHeatmapSum: Object.values(mergedHeatmap).reduce((sum, value) => sum + value, 0),
      updateKeys: Object.keys(updates),
      fulfilledTasks: settled.filter((result) => result.status === "fulfilled").length,
      rejectedTasks: settled.filter((result) => result.status === "rejected").length,
    },
    "platform-sync merge"
  );

  const [, updatedProfile] = await prisma.$transaction([
    prisma.profile.upsert({
      where: { userId: profile.userId },
      update: { streak: streakSummary.currentStreak },
      create: { userId: profile.userId, streak: streakSummary.currentStreak, skills: [] },
    }),
    prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        ...updates,
        activityHeatmap: mergedHeatmap,
        currentStreak: streakSummary.currentStreak,
        longestStreak: streakSummary.longestStreak,
        lastActiveDate: streakSummary.lastActiveDate,
        lastSyncedAt: new Date(),
      },
      include: {
        skills: true,
        projects: true,
        achievements: true,
      },
    }),
  ]);

  await recomputeStudentIntelligence(profile.userId).catch((error) => {
    logger.warn({ userId: profile.userId, error: String(error) }, "Student intelligence recompute failed after sync");
  });

  return updatedProfile;
}

export async function syncStudentProfileByUserId(
  userId: string,
  platform: PlatformSyncTarget = "all"
) {
  const profile = await ensureStudentProfile(userId);
  return syncStudentProfileById(profile.id, platform);
}

export async function syncAllStudentProfiles() {
  const profiles = await prisma.studentProfile.findMany({
    select: { id: true },
  });

  const settled = await Promise.allSettled(
    profiles.map((profile) => syncStudentProfileById(profile.id))
  );

  const successCount = settled.filter((result) => result.status === "fulfilled").length;
  const failureCount = settled.length - successCount;

  logger.info({ successCount, failureCount }, "Completed student platform sync run");

  return { successCount, failureCount };
}

export function startPlatformSyncJob() {
  cron.schedule(
    "0 2 * * *",
    () => {
      void syncAllStudentProfiles().catch((error) => {
        logger.error({ error }, "Platform sync job failed");
      });
    },
    { timezone: process.env["TZ"] ?? "Asia/Kolkata" }
  );
}
