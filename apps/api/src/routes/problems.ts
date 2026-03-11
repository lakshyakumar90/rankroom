import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate, requireRole, optionalAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { createProblemSchema, createTestCaseSchema, bulkCreateTestCasesSchema, paginationSchema } from "@repo/validators";
import { Role } from "@repo/types";
import { z } from "zod";

const router = Router();

const problemFiltersSchema = paginationSchema.extend({
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});

// GET /api/problems
router.get("/", optionalAuth, validate(problemFiltersSchema, "query"), async (req, res, next) => {
  try {
    const { page, limit, difficulty, tag, search } = req.query as {
      page: string; limit: string; difficulty?: string; tag?: string; search?: string;
    };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isPublished: true,
      ...(difficulty ? { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { tags: { has: search } }] } : {}),
    };

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        select: {
          id: true, title: true, slug: true, difficulty: true, tags: true,
          points: true, createdAt: true,
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.problem.count({ where }),
    ]);

    // If user is authenticated, mark solved status
    let solvedSet = new Set<string>();
    if (req.user) {
      const solved = await prisma.submission.findMany({
        where: { userId: req.user.id, status: "ACCEPTED", problemId: { in: problems.map((p) => p.id) } },
        select: { problemId: true },
        distinct: ["problemId"],
      });
      solvedSet = new Set(solved.map((s) => s.problemId));
    }

    const withStatus = problems.map((p) => ({ ...p, isSolved: solvedSet.has(p.id) }));

    res.json({
      success: true,
      data: withStatus,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/problems/:slug
router.get("/:slug", optionalAuth, async (req, res, next) => {
  try {
    const problem = await prisma.problem.findUnique({
      where: { slug: req.params.slug },
      include: {
        testCases: {
          where: { isSample: true },
          select: { id: true, input: true, expectedOutput: true, isSample: true },
        },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (!problem || (!problem.isPublished && req.user?.role === "STUDENT")) {
      throw new AppError("Problem not found", 404);
    }

    res.json({ success: true, data: problem });
  } catch (err) {
    next(err);
  }
});

// POST /api/problems - create problem (admin/teacher)
router.post("/", authenticate, requireRole(Role.ADMIN, Role.TEACHER), validate(createProblemSchema), async (req, res, next) => {
  try {
    const problem = await prisma.problem.create({
      data: { ...req.body, createdById: req.user!.id },
    });
    res.status(201).json({ success: true, data: problem });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/problems/:id
router.patch("/:id", authenticate, requireRole(Role.ADMIN, Role.TEACHER), async (req, res, next) => {
  try {
    const problem = await prisma.problem.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: problem });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/problems/:id
router.delete("/:id", authenticate, requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    await prisma.problem.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Problem deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /api/problems/:id/test-cases - add test cases
router.post("/:id/test-cases", authenticate, requireRole(Role.ADMIN, Role.TEACHER), validate(bulkCreateTestCasesSchema), async (req, res, next) => {
  try {
    const { testCases } = req.body as { testCases: { input: string; expectedOutput: string; isSample: boolean; isHidden: boolean }[] };
    const created = await prisma.testCase.createMany({
      data: testCases.map((tc) => ({ ...tc, problemId: req.params.id })),
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// GET /api/problems/:id/test-cases - list test cases (admin/teacher)
router.get("/:id/test-cases", authenticate, requireRole(Role.ADMIN, Role.TEACHER), async (req, res, next) => {
  try {
    const testCases = await prisma.testCase.findMany({ where: { problemId: req.params.id } });
    res.json({ success: true, data: testCases });
  } catch (err) {
    next(err);
  }
});

// GET /api/problems/:id/submissions - own submissions for this problem
router.get("/:id/submissions", authenticate, async (req, res, next) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { problemId: req.params.id, userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ success: true, data: submissions });
  } catch (err) {
    next(err);
  }
});

export default router;
