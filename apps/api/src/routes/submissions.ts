import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error";
import type { SubmissionResult } from "@repo/types";

const router: ExpressRouter = Router();
router.use(authenticate);

function toVerdict(status: string): SubmissionResult["verdict"] {
  switch (status) {
    case "ACCEPTED":
      return "AC";
    case "WRONG_ANSWER":
      return "WA";
    case "TIME_LIMIT_EXCEEDED":
      return "TLE";
    case "MEMORY_LIMIT_EXCEEDED":
      return "MLE";
    case "COMPILATION_ERROR":
      return "CE";
    case "RUNTIME_ERROR":
      return "RE";
    case "PENDING":
    default:
      return "JUDGING";
  }
}

router.get("/:submissionId", async (req, res, next) => {
  try {
    const submission = await prisma.submission.findFirst({
      where: {
        id: req.params.submissionId,
        userId: req.user!.id,
      },
    });

    if (!submission) {
      throw new AppError("Submission not found", 404);
    }

    const result: SubmissionResult = {
      submissionId: submission.id,
      verdict: toVerdict(submission.status),
      runtime: submission.runtime ?? null,
      memory: submission.memory ?? null,
      testResults: ((submission.verdict as SubmissionResult["testResults"] | null) ?? []),
      submittedAt: submission.createdAt.toISOString(),
    };

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
