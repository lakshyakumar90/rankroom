import cron from "node-cron";
import { prisma, type Prisma } from "@repo/database";
import { AppError } from "../middleware/error";
import { logger } from "../lib/logger";
import { ensureStudentProfile } from "../services/student-profile.service";

const LEETCODE_GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";
const GITHUB_CONTRIBUTIONS_ENDPOINT = "https://github-contributions-api.jogruber.de/v4";

const LEETCODE_QUERY = `
  query userCalendarAndStats($username: String!) {
    matchedUser(username: $username) {
      submitStatsGlobal {
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

function normalizeDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function timestampToDateKey(timestamp: string | number) {
  const numeric = typeof timestamp === "string" ? Number.parseInt(timestamp, 10) : timestamp;
  return normalizeDateKey(new Date(numeric * 1000));
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

async function safeJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

async function safeText(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.text();
}

function parseLeetCodeCalendar(rawCalendar: string | null | undefined) {
  if (!rawCalendar) return {};

  try {
    const parsed = JSON.parse(rawCalendar) as Record<string, number>;
    return Object.fromEntries(
      Object.entries(parsed).map(([timestamp, count]) => [timestampToDateKey(timestamp), count])
    );
  } catch {
    return {};
  }
}

async function syncLeetCode(username: string): Promise<SyncPayload> {
  type LeetCodeResponse = {
    data?: {
      matchedUser?: {
        submitStatsGlobal?: {
          acSubmissionNum?: Array<{ difficulty: string; count: number }>;
        };
        userCalendar?: {
          submissionCalendar?: string;
        };
      } | null;
    };
  };

  const response = await safeJson<LeetCodeResponse>(LEETCODE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: LEETCODE_QUERY,
      variables: { username },
    }),
  });

  const stats = response.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum ?? [];
  const solvedByDifficulty = new Map(stats.map((entry) => [entry.difficulty.toUpperCase(), entry.count]));
  const heatmap = parseLeetCodeCalendar(
    response.data?.matchedUser?.userCalendar?.submissionCalendar
  );

  return {
    updates: {
      leetcodeSolved: solvedByDifficulty.get("ALL") ?? 0,
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
    const count = typeof item["count"] === "number" ? item["count"] : 0;
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
      const count = typeof day["contributionCount"] === "number" ? day["contributionCount"] : 0;
      if (date) {
        heatmap[date] = Math.max(heatmap[date] ?? 0, count);
      }
    }
  }

  total =
    total ||
    (typeof payload["totalContributions"] === "number"
      ? (payload["totalContributions"] as number)
      : typeof payload["total"] === "number"
        ? (payload["total"] as number)
        : Object.values(heatmap).reduce((sum, value) => sum + value, 0));

  return { total, heatmap };
}

async function syncGitHub(username: string): Promise<SyncPayload> {
  const [contributionsPayload, repos] = await Promise.all([
    safeJson<Record<string, unknown>>(`${GITHUB_CONTRIBUTIONS_ENDPOINT}/${username}`).catch(() => ({})),
    safeJson<Array<{ language: string | null }>>(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`).catch(
      () => []
    ),
  ]);

  const { total, heatmap } = parseGitHubContributionCalendar(contributionsPayload);
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
    const date = normalizeDateKey(submission.createdAt);
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

  if (selectedPlatforms.includes("leetcode") && profile.leetcodeUsername) {
    tasks.push(syncLeetCode(profile.leetcodeUsername));
  }
  if (selectedPlatforms.includes("github") && profile.githubUsername) {
    tasks.push(syncGitHub(profile.githubUsername));
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

  return prisma.studentProfile.update({
    where: { id: profile.id },
    data: {
      ...updates,
      activityHeatmap: mergeHeatmaps(...heatmaps),
      lastSyncedAt: new Date(),
    },
    include: {
      skills: true,
      projects: true,
      achievements: true,
    },
  });
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
