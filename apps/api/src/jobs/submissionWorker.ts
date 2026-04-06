import { Queue, Worker } from "bullmq";
import { prisma, Prisma } from "@repo/database";
import { DIFFICULTY_POINTS, Difficulty, type SubmissionResult, type TestResult, type Verdict } from "@repo/types";
import { createRedisConnection } from "../lib/redis";
import { logger } from "../lib/logger";
import { emitContestStandingUpdate, emitSubmissionResult } from "../lib/socket";
import { logActivity } from "../lib/activity";
import { runBatch, toTestResult } from "../services/judge.service";
import { executeSubmissionCases, normalizeExecutionSource } from "../services/execution.service";
import type { CompareMode } from "../services/comparator.service";
import { recomputeSectionLeaderboard } from "../services/leaderboard.service";
import { recomputeStudentIntelligence } from "../services/student-intelligence.service";
import { getJudge0LanguageId } from "../lib/judge0-languages";
import { truncateUtf8 } from "../config/execution";
import { WORKER_CONCURRENCY } from "../config/judge0";

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
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { penaltyMinutes: true, startTime: true },
  });
  if (!contest) return;

  const [contestProblems, users, submissions] = await Promise.all([
    prisma.contestProblem.findMany({ where: { contestId } }),
    prisma.contestRegistration.findMany({
      where: { contestId, status: { not: "WITHDRAWN" } },
      select: { userId: true },
    }),
    prisma.submission.findMany({
      where: { contestId },
      select: { userId: true, problemId: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const pointsByProblem = new Map(contestProblems.map((entry) => [entry.problemId, entry.points]));
  const userIds = [...new Set([...users.map((entry) => entry.userId), ...submissions.map((entry) => entry.userId), userId])];
  const penaltyMinutes = contest.penaltyMinutes ?? 10;

  const recalculated = userIds.map((currentUserId) => {
    const userSubs = submissions.filter((entry) => entry.userId === currentUserId);
    const perProblemResults: Record<string, {
      accepted: boolean;
      wrongCount: number;
      acceptedAt: string | null;
      solveTimeSeconds: number | null;
    }> = {};

    let solvedCount = 0;
    let acceptedCount = 0;
    let wrongCount = 0;
    let totalScore = 0;
    let penalty = 0;
    let solveTimeSeconds = 0;
    let lastAcceptedTime: Date | null = null;
    let lastSubmitTime: Date | null = null;

    for (const contestProblem of contestProblems) {
      const problemSubs = userSubs.filter((entry) => entry.problemId === contestProblem.problemId);
      const acceptedSubmission = problemSubs.find((entry) => entry.status === "ACCEPTED") ?? null;
      const wrongBeforeAccepted = problemSubs.filter((entry) =>
        entry.status !== "ACCEPTED" && (!acceptedSubmission || entry.createdAt < acceptedSubmission.createdAt)
      ).length;

      const accepted = Boolean(acceptedSubmission);
      const acceptedAt = acceptedSubmission?.createdAt ?? null;
      const currentSolveTimeSeconds = acceptedAt
        ? Math.max(0, Math.floor((acceptedAt.getTime() - contest.startTime.getTime()) / 1000))
        : null;

      perProblemResults[contestProblem.problemId] = {
        accepted,
        wrongCount: wrongBeforeAccepted,
        acceptedAt: acceptedAt?.toISOString() ?? null,
        solveTimeSeconds: currentSolveTimeSeconds,
      };

      wrongCount += wrongBeforeAccepted;
      if (acceptedSubmission) {
        solvedCount += 1;
        acceptedCount += 1;
        totalScore += pointsByProblem.get(contestProblem.problemId) ?? 0;
        penalty += wrongBeforeAccepted * penaltyMinutes;
        solveTimeSeconds += currentSolveTimeSeconds ?? 0;
        if (!lastAcceptedTime || acceptedSubmission.createdAt > lastAcceptedTime) {
          lastAcceptedTime = acceptedSubmission.createdAt;
        }
      }
    }

    lastSubmitTime = userSubs[userSubs.length - 1]?.createdAt ?? null;

    return {
      contestId,
      userId: currentUserId,
      totalScore,
      solvedCount,
      acceptedCount,
      wrongCount,
      penalty: penalty + Math.floor(solveTimeSeconds / 60),
      solveTimeSeconds,
      perProblemResults,
      lastAcceptedTime,
      lastSubmitTime,
    };
  });

  recalculated.sort(
    (a, b) =>
      b.solvedCount - a.solvedCount ||
      a.penalty - b.penalty ||
      a.solveTimeSeconds - b.solveTimeSeconds ||
      (a.lastAcceptedTime?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.lastAcceptedTime?.getTime() ?? Number.MAX_SAFE_INTEGER)
  );

  await prisma.$transaction(
    recalculated.map((entry, index) =>
      prisma.contestStanding.upsert({
        where: { contestId_userId: { contestId, userId: entry.userId } },
        update: {
          totalScore: entry.totalScore,
          solvedCount: entry.solvedCount,
          acceptedCount: entry.acceptedCount,
          wrongCount: entry.wrongCount,
          penalty: entry.penalty,
          solveTimeSeconds: entry.solveTimeSeconds,
          perProblemResults: entry.perProblemResults as Prisma.InputJsonValue,
          lastAcceptedTime: entry.lastAcceptedTime,
          lastSubmitTime: entry.lastSubmitTime,
          rank: index + 1,
        },
        create: {
          contestId,
          userId: entry.userId,
          totalScore: entry.totalScore,
          solvedCount: entry.solvedCount,
          acceptedCount: entry.acceptedCount,
          wrongCount: entry.wrongCount,
          penalty: entry.penalty,
          solveTimeSeconds: entry.solveTimeSeconds,
          perProblemResults: entry.perProblemResults as Prisma.InputJsonValue,
          lastAcceptedTime: entry.lastAcceptedTime,
          lastSubmitTime: entry.lastSubmitTime,
          rank: index + 1,
        },
      })
    )
  );

  const hydratedStandings = await prisma.contestStanding.findMany({
    where: { contestId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: [{ rank: "asc" }],
  });

  emitContestStandingUpdate(contestId, hydratedStandings);
}

export function startSubmissionWorker() {
  return new Worker<SubmissionJobData>(
    SUBMISSION_QUEUE,
    async (job) => {
      const { submissionId, userId, problemId, source_code, language, contestId } = job.data;
      logger.info({ submissionId }, "Processing submission job");

      const existingSubmission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });

      if (!existingSubmission) {
        logger.warn({ submissionId }, "Submission not found while processing queue job");
        return;
      }

      if (existingSubmission.status !== "PENDING") {
        logger.info({ submissionId, status: existingSubmission.status }, "Skipping already processed submission job");
        return;
      }

      emitSubmissionResult(userId, {
        submissionId,
        verdict: "JUDGING",
        runtime: null,
        memory: null,
        testResults: [],
        submittedAt: new Date().toISOString(),
      });

      const problem = await prisma.problem.findUnique({
        where: { id: problemId },
        select: { functionName: true, returnType: true, parameterTypes: true, compareMode: true, timeLimitMs: true, memoryLimitKb: true, difficulty: true },
      });

      if (!problem) throw new Error(`Problem not found: ${problemId}`);

      let testCases = await prisma.testCase.findMany({
        where: { problemId, isHidden: true },
        orderBy: { createdAt: "asc" },
      });

      if (contestId && testCases.length === 0) {
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: "WRONG_ANSWER",
            verdict: [{ error: "Contest submissions require hidden test cases." }] as unknown as Prisma.InputJsonValue,
          },
        });

        emitSubmissionResult(userId, {
          submissionId,
          verdict: "WA",
          runtime: null,
          memory: null,
          testResults: [],
          submittedAt: new Date().toISOString(),
        });
        return;
      }

      if (testCases.length === 0) {
        // Fallback to sample (non-hidden) test cases so the submission can still be judged
        testCases = await prisma.testCase.findMany({
          where: { problemId, isHidden: false },
          orderBy: { createdAt: "asc" },
        });

        if (testCases.length === 0) {
          await prisma.submission.update({
            where: { id: submissionId },
            data: { status: "WRONG_ANSWER", verdict: [{ error: "No test cases configured for this problem." }] as unknown as Prisma.InputJsonValue },
          });
          emitSubmissionResult(userId, {
            submissionId,
            verdict: "WA",
            runtime: null,
            memory: null,
            testResults: [],
            submittedAt: new Date().toISOString(),
          });
          return;
        }

        logger.warn({ problemId }, "No hidden test cases found — judging against sample test cases");
      }

      // Use wrapped execution when the problem has function metadata AND the language
      // supports wrapping (cpp / c / python). This ensures user code
      // (function-only, no main()) gets a proper entry point before reaching Judge0.
      const wrappedLanguages = ["python", "cpp", "c"];
      const canWrap =
        !!problem.functionName &&
        !!problem.returnType &&
        Array.isArray(problem.parameterTypes) &&
        (problem.parameterTypes as unknown[]).length > 0 &&
        wrappedLanguages.includes(language);

      let testResults: TestResult[];

      if (canWrap) {
        const summary = await executeSubmissionCases({
          problem: {
            id: problemId,
            functionName: problem.functionName,
            parameterTypes: problem.parameterTypes,
            returnType: problem.returnType,
            compareMode: (problem.compareMode ?? "EXACT") as CompareMode,
            timeLimitMs: problem.timeLimitMs,
            memoryLimitKb: problem.memoryLimitKb,
          },
          userCode: source_code,
          language,
          testCases: testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
          })),
        });

        testResults = summary.results.map((r) => ({
          caseIndex: r.caseIndex,
          // "IE" (Internal Error) is not in the Verdict union — map it to "RE"
          verdict: (r.verdict === "IE" ? "RE" : r.verdict) as Verdict,
          stdout: truncateUtf8(r.stdout),
          expected: r.expected,
          stderr: truncateUtf8(r.stderr),
          compileOutput: truncateUtf8(r.compileOutput),
          runtime: r.runtime ?? null,
          memory: r.memory ?? null,
          passed: r.passed,
        }));
      } else {
        // Raw / stream-style problems — send code directly
        const normalizedExecution = normalizeExecutionSource(language, source_code);
        const languageId = await getJudge0LanguageId(normalizedExecution.effectiveLanguage);
        if (!languageId) {
          throw new Error(`Unsupported language: ${normalizedExecution.effectiveLanguage}`);
        }

        const judgeResults = await runBatch(
          normalizedExecution.effectiveUserCode,
          languageId,
          testCases.map((testCase) => ({
            input: testCase.input,
            expected_output: testCase.expectedOutput,
          }))
        );
        testResults = judgeResults.map((result, index) =>
          toTestResult(result, index, testCases[index]?.expectedOutput ?? null)
        );
      }

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
        await leaderboardQueue.add("update" as const, {
          userId,
          problemId,
          difficulty: problem.difficulty as Difficulty,
        });

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

        await recomputeStudentIntelligence(userId).catch((error) => {
          logger.warn({ userId, problemId, error: String(error) }, "Student intelligence recompute failed after accepted submission");
        });
      }
    },
    { connection: createRedisConnection() as never, concurrency: WORKER_CONCURRENCY }
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
