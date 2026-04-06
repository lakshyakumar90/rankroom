import { prisma } from "@repo/database";
import {
  Difficulty,
  NotificationType,
  type JWTPayload,
  type SkillGraphResponse,
  type SkillKey,
  type SkillScorePoint,
} from "@repo/types";
import { AppError } from "../middleware/error";
import { emitNotificationToUser } from "../lib/socket";
import { generateCoachAdvice } from "./coach.service";

const SKILL_LABELS: Record<SkillKey, string> = {
  arrays: "Arrays",
  strings: "Strings",
  hashing: "Hashing",
  sorting: "Sorting",
  binary_search: "Binary Search",
  two_pointers: "Two Pointers",
  sliding_window: "Sliding Window",
  linked_lists: "Linked Lists",
  stacks_queues: "Stacks & Queues",
  trees: "Trees",
  bst: "BST",
  heaps: "Heaps",
  graphs: "Graphs",
  greedy: "Greedy",
  dp: "Dynamic Programming",
  backtracking: "Backtracking",
  recursion: "Recursion",
  math: "Math",
  bit_manipulation: "Bit Manipulation",
  system_design: "System Design",
};

const TAG_TO_SKILL_MAP: Record<string, SkillKey> = {
  array: "arrays",
  arrays: "arrays",
  string: "strings",
  strings: "strings",
  hash: "hashing",
  hashing: "hashing",
  hashmap: "hashing",
  set: "hashing",
  sorting: "sorting",
  sort: "sorting",
  "binary-search": "binary_search",
  binarysearch: "binary_search",
  "binary search": "binary_search",
  "two-pointers": "two_pointers",
  twopointers: "two_pointers",
  "two pointers": "two_pointers",
  "sliding-window": "sliding_window",
  slidingwindow: "sliding_window",
  "sliding window": "sliding_window",
  linkedlist: "linked_lists",
  "linked-list": "linked_lists",
  "linked list": "linked_lists",
  stack: "stacks_queues",
  queue: "stacks_queues",
  "stacks-queues": "stacks_queues",
  tree: "trees",
  trees: "trees",
  bst: "bst",
  heap: "heaps",
  heaps: "heaps",
  graph: "graphs",
  graphs: "graphs",
  greedy: "greedy",
  dp: "dp",
  dynamicprogramming: "dp",
  "dynamic-programming": "dp",
  "dynamic programming": "dp",
  backtracking: "backtracking",
  recursion: "recursion",
  math: "math",
  maths: "math",
  bit: "bit_manipulation",
  bitmask: "bit_manipulation",
  "bit-manipulation": "bit_manipulation",
  "bit manipulation": "bit_manipulation",
  "system-design": "system_design",
  systemdesign: "system_design",
  "system design": "system_design",
};

const DIFFICULTY_WEIGHTS: Record<Difficulty, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

function normalizeTag(tag: string): SkillKey | null {
  const normalized = tag.trim().toLowerCase().replace(/[_\s]+/g, "-");
  return TAG_TO_SKILL_MAP[normalized] ?? TAG_TO_SKILL_MAP[tag.trim().toLowerCase()] ?? null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function toDateOnlyString(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function buildEmptyResponse(): SkillGraphResponse {
  return {
    skills: [],
    summary: {
      activityScore: 0,
      consistencyScore: 0,
      strongestSkills: [],
      weakestSkills: [],
    },
    history: [],
    coachAdvice: null,
  };
}

function coerceSkillMap(value: unknown): Partial<Record<SkillKey, number>> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const next: Partial<Record<SkillKey, number>> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!(key in SKILL_LABELS)) continue;
    const parsed = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(parsed)) {
      next[key as SkillKey] = round2(parsed);
    }
  }
  return next;
}

async function createCoachNotification(
  userId: string,
  advice: Awaited<ReturnType<typeof prisma.coachAdvice.create>>
) {
  const dedupeKey = `coach-advice:${userId}:${advice.adviceDate.toISOString().slice(0, 10)}`;
  const existing = await prisma.notification.findFirst({
    where: { userId, dedupeKey },
  });

  if (existing) {
    return existing;
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type: NotificationType.COACH_ADVICE_READY as any,
      title: "Your daily coach advice is ready",
      message: advice.warning,
      link: "/dashboard",
      entityId: advice.id,
      entityType: "COACH_ADVICE",
      dedupeKey,
    },
  });

  emitNotificationToUser(userId, {
    id: notification.id,
    userId: notification.userId,
    type: notification.type as NotificationType,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    link: notification.link,
    entityId: notification.entityId,
    entityType: notification.entityType,
    targetRole: notification.targetRole as any,
    targetSectionId: notification.targetSectionId,
    targetDepartmentId: notification.targetDepartmentId,
    createdAt: notification.createdAt.toISOString(),
  });

  return notification;
}

export async function recomputeStudentIntelligence(userId: string) {
  const [studentProfile, acceptedSubmissions, contestStandings, previousSnapshot] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        userId: true,
        activityHeatmap: true,
        currentStreak: true,
        lastActiveDate: true,
      },
    }),
    prisma.submission.findMany({
      where: { userId, status: "ACCEPTED" },
      distinct: ["problemId"],
      select: {
        contestId: true,
        createdAt: true,
        problem: {
          select: {
            id: true,
            difficulty: true,
            tags: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contestStanding.findMany({
      where: { userId },
      select: {
        rank: true,
        solvedCount: true,
        totalScore: true,
        contest: { select: { endTime: true } },
      },
      orderBy: { contest: { endTime: "desc" } },
      take: 10,
    }),
    prisma.userSkillSnapshot.findFirst({
      where: {
        userId,
        snapshotDate: { lt: startOfToday() },
      },
      orderBy: { snapshotDate: "desc" },
    }),
  ]);

  if (!studentProfile) {
    throw new AppError("Student profile not found", 404);
  }

  const heatmap = (studentProfile.activityHeatmap as Record<string, number> | null) ?? {};
  const last30Keys = Object.entries(heatmap).filter(([date]) => {
    const current = new Date(date);
    return Number.isFinite(current.getTime()) && current >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  });
  const activeDays30 = last30Keys.filter(([, count]) => (count ?? 0) > 0).length;
  const totalActivity30 = last30Keys.reduce((sum, [, count]) => sum + Math.max(0, count ?? 0), 0);
  const recentAccepted30 = acceptedSubmissions.filter(
    (submission) => submission.createdAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  const activityScore = round2(clamp(activeDays30 * 2 + recentAccepted30 * 4 + Math.min(totalActivity30, 20)));
  const consistencyScore = round2(clamp(activeDays30 * 2.2 + (studentProfile.currentStreak ?? 0) * 4));

  const solvedRaw = new Map<SkillKey, number>();
  const contestRaw = new Map<SkillKey, number>();

  for (const submission of acceptedSubmissions) {
    const weight = DIFFICULTY_WEIGHTS[submission.problem.difficulty] ?? 1;
    const skillKeys = [...new Set((submission.problem.tags ?? []).map(normalizeTag).filter(Boolean) as SkillKey[])];

    for (const skillKey of skillKeys) {
      solvedRaw.set(skillKey, (solvedRaw.get(skillKey) ?? 0) + weight);
      if (submission.contestId) {
        contestRaw.set(skillKey, (contestRaw.get(skillKey) ?? 0) + weight);
      }
    }
  }

  const rankBonus = contestStandings.reduce((sum, standing) => {
    if (!standing.rank) return sum;
    return sum + Math.max(0, 25 - standing.rank);
  }, 0);

  const computedSkills: Partial<Record<SkillKey, number>> = {};
  for (const skillKey of Object.keys(SKILL_LABELS) as SkillKey[]) {
    const solvedDifficultyComponent = (solvedRaw.get(skillKey) ?? 0) * 10;
    const contestPerformance = ((contestRaw.get(skillKey) ?? 0) * 8 + rankBonus) * 0.4;
    const consistency = consistencyScore * 0.3;
    const score = round2(clamp(solvedDifficultyComponent + contestPerformance + consistency));

    if (score > 0) {
      computedSkills[skillKey] = score;
    }
  }

  const today = startOfToday();
  const skillProfile = await prisma.userSkillProfile.upsert({
    where: { userId },
    update: {
      skills: computedSkills,
      activityScore,
      consistencyScore,
      lastComputedAt: new Date(),
    },
    create: {
      userId,
      skills: computedSkills,
      activityScore,
      consistencyScore,
      lastComputedAt: new Date(),
    },
  });

  await prisma.userSkillSnapshot.upsert({
    where: {
      userId_snapshotDate: {
        userId,
        snapshotDate: today,
      },
    },
    update: {
      skillsSnapshot: computedSkills,
      activityScore,
      consistencyScore,
    },
    create: {
      userId,
      snapshotDate: today,
      skillsSnapshot: computedSkills,
      activityScore,
      consistencyScore,
    },
  });

  const recentContestRank = contestStandings[0]?.rank ?? null;
  const existingAdvice = await prisma.coachAdvice.findUnique({
    where: {
      userId_adviceDate: {
        userId,
        adviceDate: today,
      },
    },
  });

  if (!existingAdvice) {
    const previousSkills = coerceSkillMap(previousSnapshot?.skillsSnapshot);
    const currentSkills = (Object.keys(computedSkills) as SkillKey[]).map((key) => ({
      key,
      label: SKILL_LABELS[key],
      score: computedSkills[key] ?? 0,
      trend: round2((computedSkills[key] ?? 0) - (previousSkills[key] ?? 0)),
      lastUpdated: skillProfile.lastComputedAt.toISOString(),
    }));
    const strongestSkills = [...currentSkills].sort((left, right) => right.score - left.score).slice(0, 3);
    const weakestSkills = [...currentSkills].sort((left, right) => left.score - right.score).slice(0, 3);

    const coach = await generateCoachAdvice({
      userId,
      skills: currentSkills,
      summary: {
        activityScore,
        consistencyScore,
        strongestSkills,
        weakestSkills,
      },
      currentStreak: studentProfile.currentStreak ?? 0,
      lastActiveDate: toDateOnlyString(studentProfile.lastActiveDate),
      recentContestRank,
    });

    const advice = await prisma.coachAdvice.create({
      data: {
        userId,
        adviceDate: today,
        warning: coach.warning,
        motivation: coach.motivation,
        tasks: coach.tasks,
        source: coach.source,
      },
    });

    await createCoachNotification(userId, advice);
  }

  return skillProfile;
}

export async function recomputeAllStudentIntelligence() {
  const students = await prisma.studentProfile.findMany({
    select: { userId: true },
  });

  const settled = await Promise.allSettled(students.map((student) => recomputeStudentIntelligence(student.userId)));
  return {
    successCount: settled.filter((result) => result.status === "fulfilled").length,
    failureCount: settled.filter((result) => result.status === "rejected").length,
  };
}

export async function getSkillGraphResponse(userId: string, days = 30): Promise<SkillGraphResponse> {
  let profile = await prisma.userSkillProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    await recomputeStudentIntelligence(userId);
    profile = await prisma.userSkillProfile.findUnique({
      where: { userId },
    });
  }

  if (!profile) {
    return buildEmptyResponse();
  }

  const [historyRows, latestAdvice, previousSnapshot] = await Promise.all([
    prisma.userSkillSnapshot.findMany({
      where: {
        userId,
        snapshotDate: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { snapshotDate: "asc" },
    }),
    prisma.coachAdvice.findFirst({
      where: { userId },
      orderBy: { adviceDate: "desc" },
    }),
    prisma.userSkillSnapshot.findFirst({
      where: {
        userId,
        snapshotDate: { lt: startOfToday() },
      },
      orderBy: { snapshotDate: "desc" },
    }),
  ]);

  const currentSkills = coerceSkillMap(profile.skills);
  const priorSkills = coerceSkillMap(previousSnapshot?.skillsSnapshot);
  const skills: SkillScorePoint[] = (Object.keys(currentSkills) as SkillKey[])
    .map((key) => ({
      key,
      label: SKILL_LABELS[key],
      score: round2(currentSkills[key] ?? 0),
      trend: round2((currentSkills[key] ?? 0) - (priorSkills[key] ?? 0)),
      lastUpdated: profile.lastComputedAt.toISOString(),
    }))
    .sort((left, right) => right.score - left.score);

  const strongestSkills = skills.slice(0, 3);
  const weakestSkills = [...skills].sort((left, right) => left.score - right.score).slice(0, 3);

  return {
    skills,
    summary: {
      activityScore: round2(profile.activityScore),
      consistencyScore: round2(profile.consistencyScore),
      strongestSkills,
      weakestSkills,
    },
    history: historyRows.map((row) => ({
      date: row.snapshotDate.toISOString().slice(0, 10),
      skillsSnapshot: coerceSkillMap(row.skillsSnapshot),
      activityScore: round2(row.activityScore),
      consistencyScore: round2(row.consistencyScore),
    })),
    coachAdvice: latestAdvice
      ? {
          id: latestAdvice.id,
          userId: latestAdvice.userId,
          adviceDate: latestAdvice.adviceDate.toISOString().slice(0, 10),
          warning: latestAdvice.warning,
          motivation: latestAdvice.motivation,
          tasks: latestAdvice.tasks,
          source: latestAdvice.source,
          createdAt: latestAdvice.createdAt.toISOString(),
        }
      : null,
  };
}

export async function getStudentSkillAnalyticsForViewer(
  viewer: JWTPayload,
  studentId: string,
  days = 30
) {
  if (viewer.role === "STUDENT" && viewer.id !== studentId) {
    throw new AppError("Students can only view their own skills", 403);
  }

  if (viewer.role !== "STUDENT" && viewer.role !== "ADMIN" && viewer.role !== "SUPER_ADMIN") {
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId },
      select: { sectionId: true, section: { select: { departmentId: true } } },
    });

    if (
      !enrollment ||
      (!viewer.scope.sectionIds.includes(enrollment.sectionId) &&
        !viewer.scope.departmentIds.includes(enrollment.section.departmentId))
    ) {
      throw new AppError("Forbidden", 403);
    }
  }

  return getSkillGraphResponse(studentId, days);
}
