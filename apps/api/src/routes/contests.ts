import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate, requireRole, optionalAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { createContestSchema, paginationSchema } from "@repo/validators";
import { submissionQueue } from "../workers/submissionWorker";
import { emitContestStandingUpdate } from "../lib/socket";
import { Role } from "@repo/types";
import { z } from "zod";

const router = Router();

const contestFiltersSchema = paginationSchema.extend({
  status: z.enum(["UPCOMING", "LIVE", "ENDED"]).optional(),
  type: z.enum(["PUBLIC", "PRIVATE", "INSTITUTIONAL"]).optional(),
});

// GET /api/contests
router.get("/", optionalAuth, validate(contestFiltersSchema, "query"), async (req, res, next) => {
  try {
    const { page, limit, status, type } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Auto-update contest statuses
    const now = new Date();
    await prisma.contest.updateMany({ where: { status: "UPCOMING", startTime: { lte: now } }, data: { status: "LIVE" } });
    await prisma.contest.updateMany({ where: { status: "LIVE", endTime: { lte: now } }, data: { status: "ENDED" } });

    const where = {
      ...(status ? { status: status as "UPCOMING" | "LIVE" | "ENDED" } : {}),
      ...(type ? { type: type as "PUBLIC" | "PRIVATE" | "INSTITUTIONAL" } : {}),
    };

    const [contests, total] = await Promise.all([
      prisma.contest.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { registrations: true, problems: true } },
        },
        orderBy: { startTime: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.contest.count({ where }),
    ]);

    res.json({ success: true, data: contests, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/contests/:id
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const contest = await prisma.contest.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { registrations: true, problems: true } },
      },
    });
    if (!contest) throw new AppError("Contest not found", 404);

    let isRegistered = false;
    if (req.user) {
      const reg = await prisma.contestRegistration.findUnique({
        where: { contestId_userId: { contestId: contest.id, userId: req.user.id } },
      });
      isRegistered = !!reg;
    }

    res.json({ success: true, data: { ...contest, isRegistered } });
  } catch (err) {
    next(err);
  }
});

// POST /api/contests - create contest
router.post("/", authenticate, requireRole(Role.ADMIN, Role.TEACHER), validate(createContestSchema), async (req, res, next) => {
  try {
    const { problemIds, ...rest } = req.body as { problemIds: string[]; [key: string]: unknown };

    const contest = await prisma.contest.create({
      data: {
        ...(rest as { title: string; description: string; startTime: string; endTime: string; type?: "PUBLIC" | "PRIVATE" | "INSTITUTIONAL"; rules?: string }),
        createdById: req.user!.id,
        startTime: new Date(rest.startTime as string),
        endTime: new Date(rest.endTime as string),
        problems: {
          create: problemIds.map((id, idx) => ({ problemId: id, order: idx + 1, points: 100 })),
        },
      },
      include: { problems: { include: { problem: { select: { title: true, difficulty: true } } } } },
    });

    res.status(201).json({ success: true, data: contest });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/contests/:id
router.patch("/:id", authenticate, requireRole(Role.ADMIN, Role.TEACHER), async (req, res, next) => {
  try {
    const contest = await prisma.contest.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: contest });
  } catch (err) {
    next(err);
  }
});

// POST /api/contests/:id/register
router.post("/:id/register", authenticate, async (req, res, next) => {
  try {
    const contest = await prisma.contest.findUnique({ where: { id: req.params.id } });
    if (!contest) throw new AppError("Contest not found", 404);
    if (contest.status === "ENDED") throw new AppError("Contest has ended", 400);

    const registration = await prisma.contestRegistration.upsert({
      where: { contestId_userId: { contestId: req.params.id, userId: req.user!.id } },
      update: {},
      create: { contestId: req.params.id, userId: req.user!.id },
    });

    res.json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
});

// GET /api/contests/:id/standings
router.get("/:id/standings", async (req, res, next) => {
  try {
    const standings = await prisma.contestStanding.findMany({
      where: { contestId: req.params.id },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: [{ rank: "asc" }, { totalScore: "desc" }],
    });
    res.json({ success: true, data: standings });
  } catch (err) {
    next(err);
  }
});

// GET /api/contests/:id/problems
router.get("/:id/problems", optionalAuth, async (req, res, next) => {
  try {
    const contest = await prisma.contest.findUnique({ where: { id: req.params.id } });
    if (!contest) throw new AppError("Contest not found", 404);

    // Only registered users can see problems for live/ended contests
    if (contest.status !== "UPCOMING" && req.user) {
      const reg = await prisma.contestRegistration.findUnique({
        where: { contestId_userId: { contestId: req.params.id, userId: req.user.id } },
      });
      if (!reg && req.user.role === "STUDENT") throw new AppError("You must be registered to view problems", 403);
    }

    const problems = await prisma.contestProblem.findMany({
      where: { contestId: req.params.id },
      include: {
        problem: {
          select: { id: true, title: true, slug: true, difficulty: true, tags: true, points: true },
        },
      },
      orderBy: { order: "asc" },
    });

    res.json({ success: true, data: problems });
  } catch (err) {
    next(err);
  }
});

// POST /api/contests/:id/submit - submit during contest
router.post("/:id/submit", authenticate, async (req, res, next) => {
  try {
    const { problemId, code, language } = req.body as { problemId: string; code: string; language: string };
    const contestId = req.params.id;

    const [contest, registration] = await Promise.all([
      prisma.contest.findUnique({ where: { id: contestId } }),
      prisma.contestRegistration.findUnique({ where: { contestId_userId: { contestId, userId: req.user!.id } } }),
    ]);

    if (!contest) throw new AppError("Contest not found", 404);
    if (contest.status !== "LIVE") throw new AppError("Contest is not live", 400);
    if (!registration && req.user!.role === "STUDENT") throw new AppError("Not registered for this contest", 403);

    const submission = await prisma.submission.create({
      data: { userId: req.user!.id, problemId, code, language, status: "PENDING", contestId },
    });

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

export default router;
