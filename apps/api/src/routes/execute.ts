import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { executeRunSchema, executeSubmitSchema } from "@repo/validators";
import { runCode } from "../services/judge0";
import { submissionQueue } from "../workers/submissionWorker";

const router = Router();
router.use(authenticate);

// POST /api/execute/run - run against sample test cases or custom input
router.post("/run", validate(executeRunSchema), async (req, res, next) => {
  try {
    const { problemId, code, language, customInput } = req.body as {
      problemId: string;
      code: string;
      language: string;
      customInput?: string;
    };

    // If custom input provided, run against it directly
    if (customInput !== undefined) {
      const result = await runCode({ code, language, input: customInput });
      res.json({ success: true, data: result });
      return;
    }

    // Run against sample test cases
    const testCases = await prisma.testCase.findMany({
      where: { problemId, isSample: true },
      take: 3,
    });

    if (testCases.length === 0) {
      throw new AppError("No sample test cases found", 404);
    }

    const results = await Promise.all(
      testCases.map((tc) => runCode({ code, language, input: tc.input }))
    );

    res.json({
      success: true,
      data: results.map((r, i) => ({
        ...r,
        testCase: { input: testCases[i]!.input, expectedOutput: testCases[i]!.expectedOutput },
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/execute/submit - submit against all test cases
router.post("/submit", validate(executeSubmitSchema), async (req, res, next) => {
  try {
    const { problemId, code, language, contestId } = req.body as {
      problemId: string;
      code: string;
      language: string;
      contestId?: string;
    };

    // Verify problem exists
    const problem = await prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem || !problem.isPublished) throw new AppError("Problem not found", 404);

    // Create submission record
    const submission = await prisma.submission.create({
      data: {
        userId: req.user!.id,
        problemId,
        code,
        language,
        status: "PENDING",
        contestId: contestId ?? null,
      },
    });

    // Enqueue BullMQ job
    await submissionQueue.add("submission", {
      submissionId: submission.id,
      userId: req.user!.id,
      problemId,
      code,
      language,
      contestId,
    });

    res.status(201).json({ success: true, data: { submissionId: submission.id, status: "PENDING" } });
  } catch (err) {
    next(err);
  }
});

// GET /api/execute/submission/:id - poll submission status
router.get("/submission/:id", async (req, res, next) => {
  try {
    const submission = await prisma.submission.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { problem: { select: { title: true, slug: true } } },
    });

    if (!submission) throw new AppError("Submission not found", 404);

    res.json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
});

export default router;
