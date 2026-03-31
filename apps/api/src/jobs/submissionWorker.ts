import { Queue, Worker } from "bullmq";
import { prisma, Prisma } from "@repo/database";
import { DIFFICULTY_POINTS, Difficulty, type SubmissionResult, type TestResult, type Verdict } from "@repo/types";
import { createRedisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { emitContestStandingUpdate, emitSubmissionResult } from "../lib/socket";
import { logActivity } from "../lib/activity";
import { LANGUAGE_IDS, mapVerdict, runBatch, toTestResult } from "../services/judge.service";
import { recomputeSectionLeaderboard } from "../services/leaderboard.service";

export const SUBMISSION_QUEUE = "code-submissions";
export const LEADERBOARD_QUEUE = "leaderboard-updates";

export interface SubmissionJobData {
  submissionId: string;
  userId: string;
  problemId: string;
  source_code: string;
  language: string;
  contestId?: string;
}

export interface LeaderboardJobData {
  userId: string;
  problemId: string;
  difficulty: Difficulty;
}

export const submissionQueue = new Queue<SubmissionJobData>(SUBMISSION_QUEUE, {
  connection: createRedisConnection() as never,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});

export const leaderboardQueue = new Queue<LeaderboardJobData>(LEADERBOARD_QUEUE, {
  connection: createRedisConnection() as never,
});

function mapSubmissionStatus(verdict: Verdict) {
  switch (verdict) {
    case "AC":
      return "ACCEPTED" as const;
    case "WA":
      return "WRONG_ANSWER" as const;
    case "TLE":
      return "TIME_LIMIT_EXCEEDED" as const;
    case "MLE":
      return "MEMORY_LIMIT_EXCEEDED" as const;
    case "CE":
      return "COMPILATION_ERROR" as const;
    case "RE":
      return "RUNTIME_ERROR" as const;
    default:
      return "PENDING" as const;
  }
}

async function updateContestStanding(contestId: string, userId: string, problemId: string) {
  const contestProblem = await prisma.contestProblem.findUnique({
    where: { contestId_problemId: { contestId, problemId } },
  });

  if (!contestProblem) return;

  const acceptedCount = await prisma.submission.count({
    where: { contestId, userId, problemId, status: "ACCEPTED" },
  });

  if (acceptedCount > 1) return;

  await prisma.contestStanding.upsert({
    where: { contestId_userId: { contestId, userId } },
    update: {
      totalScore: { increment: contestProblem.points },
      solvedCount: { increment: 1 },
      lastSubmitTime: new Date(),
    },
    create: {
      contestId,
      userId,
      totalScore: contestProblem.points,
      solvedCount: 1,
      lastSubmitTime: new Date(),
    },
  });

  const standings = await prisma.contestStanding.findMany({
    where: { contestId },
    orderBy: [{ totalScore: "desc" }, { lastSubmitTime: "asc" }],
  });

  await prisma.$transaction(
    standings.map((entry, index) =>
      prisma.contestStanding.update({
        where: { id: entry.id },
        data: { rank: index + 1 },
      })
    )
  );

  const hydratedStandings = await prisma.contestStanding.findMany({
    where: { contestId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: [{ rank: "asc" }, { totalScore: "desc" }],
  });

  emitContestStandingUpdate(contestId, hydratedStandings);
}

export function startSubmissionWorker() {
  return new Worker<SubmissionJobData>(
    SUBMISSION_QUEUE,
    async (job) => {
      const { submissionId, userId, problemId, source_code, language, contestId } = job.data;
      logger.info({ submissionId }, "Processing submission job");

      const languageId = LANGUAGE_IDS[language];
      if (!languageId) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const testCases = await prisma.testCase.findMany({
        where: { problemId, isHidden: true },
        orderBy: { createdAt: "asc" },
      });

      if (testCases.length === 0) {
        throw new Error("No hidden test cases configured for this problem");
      }

      const judgeResults = await runBatch(
        source_code,
        languageId,
        testCases.map((testCase) => ({
          input: testCase.input,
          expected_output: testCase.expectedOutput,
        }))
      );

      const testResults: TestResult[] = judgeResults.map((result, index) =>
        toTestResult(result, index, testCases[index]?.expectedOutput ?? null)
      );

      const firstFailure = testResults.find((result) => !result.passed);
      const verdict = firstFailure?.verdict ?? "AC";
      const runtime = Math.max(...testResults.map((result) => result.runtime ?? 0), 0) || null;
      const memory = Math.max(...testResults.map((result) => result.memory ?? 0), 0) || null;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: mapSubmissionStatus(verdict),
          runtime,
          memory,
          verdict: testResults as unknown as Prisma.InputJsonValue,
        },
      });

      const payload: SubmissionResult = {
        submissionId,
        verdict,
        runtime,
        memory,
        testResults,
        submittedAt: new Date().toISOString(),
      };

      emitSubmissionResult(userId, payload);

      if (verdict === "AC") {
        const problem = await prisma.problem.findUnique({
          where: { id: problemId },
          select: { difficulty: true },
        });

        if (problem) {
          await leaderboardQueue.add("update" as const, {
            userId,
            problemId,
            difficulty: problem.difficulty as Difficulty,
          });
        }

        if (contestId) {
          await updateContestStanding(contestId, userId, problemId);
        }

        await prisma.notification.create({
          data: {
            userId,
            type: "SUBMISSION_ACCEPTED",
            title: "Accepted",
            message: "Your solution passed all test cases.",
            link: `/problems/${problemId}`,
            entityId: submissionId,
            entityType: "SUBMISSION",
          },
        });

        const enrollments = await prisma.enrollment.findMany({
          where: { studentId: userId },
          select: { sectionId: true },
        });

        await Promise.all(
          [...new Set(enrollments.map((enrollment) => enrollment.sectionId))].map((sectionId) =>
            recomputeSectionLeaderboard(sectionId)
          )
        );

        await logActivity(userId, "submission.accepted", { problemId, contestId: contestId ?? null });
      }
    },
    { connection: createRedisConnection() as never, concurrency: 4 }
  );
}

export function startLeaderboardWorker() {
  return new Worker<LeaderboardJobData>(
    LEADERBOARD_QUEUE,
    async (job) => {
      const { userId, problemId, difficulty } = job.data;
      const previousAccepted = await prisma.submission.count({
        where: { userId, problemId, status: "ACCEPTED" },
      });

      if (previousAccepted > 1) return;

      const points = DIFFICULTY_POINTS[difficulty] ?? 10;

      await prisma.leaderboard.upsert({
        where: { userId },
        update: {
          totalPoints: { increment: points },
          problemsSolved: { increment: 1 },
          ...(difficulty === Difficulty.EASY ? { easySolved: { increment: 1 } } : {}),
          ...(difficulty === Difficulty.MEDIUM ? { mediumSolved: { increment: 1 } } : {}),
          ...(difficulty === Difficulty.HARD ? { hardSolved: { increment: 1 } } : {}),
        },
        create: {
          userId,
          totalPoints: points,
          problemsSolved: 1,
          easySolved: difficulty === Difficulty.EASY ? 1 : 0,
          mediumSolved: difficulty === Difficulty.MEDIUM ? 1 : 0,
          hardSolved: difficulty === Difficulty.HARD ? 1 : 0,
        },
      });

      await prisma.profile.upsert({
        where: { userId },
        update: { totalPoints: { increment: points } },
        create: {
          userId,
          skills: [],
          totalPoints: points,
        },
      });
    },
    { connection: createRedisConnection() as never }
  );
}
