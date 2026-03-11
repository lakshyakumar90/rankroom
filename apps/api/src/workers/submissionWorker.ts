import { Worker, Queue } from "bullmq";
import { prisma } from "@repo/database";
import { createRedisConnection } from "../lib/redis";
import { submitBatchToJudge0, getBatchJudge0Results, mapJudge0Status } from "../services/judge0";
import { emitSubmissionVerdict } from "../lib/socket";
import { logger } from "../lib/logger";
import { DIFFICULTY_POINTS, Difficulty } from "@repo/types";

export const SUBMISSION_QUEUE = "code-submissions";
export const LEADERBOARD_QUEUE = "leaderboard-updates";

export interface SubmissionJobData {
  submissionId: string;
  userId: string;
  problemId: string;
  code: string;
  language: string;
  contestId?: string;
}

export interface LeaderboardJobData {
  userId: string;
  problemId: string;
  difficulty: Difficulty;
}

// Queue instances (used to add jobs from routes)
export const submissionQueue = new Queue<SubmissionJobData>(SUBMISSION_QUEUE, {
  connection: createRedisConnection(),
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
});

export const leaderboardQueue = new Queue<LeaderboardJobData>(LEADERBOARD_QUEUE, {
  connection: createRedisConnection(),
});

export function startSubmissionWorker() {
  const worker = new Worker<SubmissionJobData>(
    SUBMISSION_QUEUE,
    async (job) => {
      const { submissionId, userId, problemId, code, language, contestId } = job.data;
      logger.info({ submissionId }, "Processing submission job");

      try {
        // Get all non-hidden test cases for the problem
        const testCases = await prisma.testCase.findMany({
          where: { problemId },
          orderBy: { isSample: "desc" },
        });

        if (testCases.length === 0) {
          await prisma.submission.update({
            where: { id: submissionId },
            data: { status: "WRONG_ANSWER" },
          });
          emitSubmissionVerdict(userId, { submissionId, status: "WRONG_ANSWER" });
          return;
        }

        // Submit all to Judge0 batch
        const tokens = await submitBatchToJudge0(
          testCases.map((tc) => ({ code, language, input: tc.input, expectedOutput: tc.expectedOutput }))
        );

        // Poll until all results are ready (with retries)
        let results = await getBatchJudge0Results(tokens);
        let retries = 0;

        while (results.some((r) => r.status.id <= 2) && retries < 10) {
          await new Promise((r) => setTimeout(r, 2000));
          results = await getBatchJudge0Results(tokens);
          retries++;
        }

        // Determine overall status
        const decode = (s?: string) => (s ? Buffer.from(s, "base64").toString("utf-8") : "");
        const verdict = results.map((r, i) => ({
          testCaseIndex: i,
          status: mapJudge0Status(r.status.id),
          stdout: decode(r.stdout),
          stderr: decode(r.stderr),
          runtime: r.time ? Math.round(parseFloat(r.time) * 1000) : undefined,
          memory: r.memory,
        }));

        const failedCase = verdict.find((v) => v.status !== "ACCEPTED");
        const overallStatus = failedCase ? failedCase.status : "ACCEPTED";
        const maxRuntime = Math.max(...verdict.map((v) => v.runtime ?? 0));
        const maxMemory = Math.max(...verdict.map((v) => v.memory ?? 0));

        // Update submission record
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: overallStatus as "PENDING" | "ACCEPTED" | "WRONG_ANSWER" | "TIME_LIMIT_EXCEEDED" | "MEMORY_LIMIT_EXCEEDED" | "COMPILATION_ERROR" | "RUNTIME_ERROR",
            runtime: maxRuntime,
            memory: maxMemory,
            verdict,
          },
        });

        // Emit real-time verdict
        emitSubmissionVerdict(userId, { submissionId, status: overallStatus, verdict });

        // If accepted, queue leaderboard update
        if (overallStatus === "ACCEPTED") {
          const problem = await prisma.problem.findUnique({ where: { id: problemId }, select: { difficulty: true } });
          if (problem) {
            await leaderboardQueue.add("update", { userId, problemId, difficulty: problem.difficulty as Difficulty });
          }

          // Update contest standing if this is a contest submission
          if (contestId) {
            await updateContestStanding(contestId, userId, problemId);
          }

          // Create notification
          await prisma.notification.create({
            data: {
              userId,
              type: "SUBMISSION_JUDGED",
              title: "Solution Accepted!",
              message: "Your solution has been accepted. Points added to your profile.",
              link: `/problems`,
            },
          });
        }

        logger.info({ submissionId, status: overallStatus }, "Submission processed");
      } catch (error) {
        logger.error({ submissionId, error }, "Submission processing failed");
        await prisma.submission.update({
          where: { id: submissionId },
          data: { status: "RUNTIME_ERROR" },
        });
        emitSubmissionVerdict(userId, { submissionId, status: "RUNTIME_ERROR" });
        throw error;
      }
    },
    { connection: createRedisConnection(), concurrency: 5 }
  );

  worker.on("completed", (job) => logger.info({ jobId: job.id }, "Submission job completed"));
  worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "Submission job failed"));

  return worker;
}

export function startLeaderboardWorker() {
  const worker = new Worker<LeaderboardJobData>(
    LEADERBOARD_QUEUE,
    async (job) => {
      const { userId, problemId, difficulty } = job.data;

      // Check if this problem was already solved by this user
      const previousAccepted = await prisma.submission.count({
        where: { userId, problemId, status: "ACCEPTED" },
      });

      // Only credit if this is the first accepted submission for this problem
      if (previousAccepted > 1) return; // >1 because we already updated this submission

      const points = DIFFICULTY_POINTS[difficulty] ?? 10;

      // Update leaderboard entry
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

      // Update profile total points
      await prisma.profile.update({
        where: { userId },
        data: { totalPoints: { increment: points } },
      });

      // Recalculate ranks (simplified: update rank based on points desc)
      const allEntries = await prisma.leaderboard.findMany({
        orderBy: { totalPoints: "desc" },
        select: { userId: true },
      });

      await prisma.$transaction(
        allEntries.map((entry, idx) =>
          prisma.leaderboard.update({
            where: { userId: entry.userId },
            data: { rank: idx + 1 },
          })
        )
      );

      logger.info({ userId, points, difficulty }, "Leaderboard updated");
    },
    { connection: createRedisConnection() }
  );

  return worker;
}

async function updateContestStanding(contestId: string, userId: string, problemId: string) {
  // Calculate score for this contest
  const contestProblem = await prisma.contestProblem.findUnique({
    where: { contestId_problemId: { contestId, problemId } },
  });
  if (!contestProblem) return;

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

  // Recalculate contest ranks
  const standings = await prisma.contestStanding.findMany({
    where: { contestId },
    orderBy: [{ totalScore: "desc" }, { lastSubmitTime: "asc" }],
  });

  await prisma.$transaction(
    standings.map((s, idx) =>
      prisma.contestStanding.update({
        where: { id: s.id },
        data: { rank: idx + 1 },
      })
    )
  );
}
