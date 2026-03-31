import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { authenticate, canAccessSection, optionalAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { createContestSchema, paginationSchema } from "@repo/validators";
import { submissionQueue } from "../jobs/submissionWorker";
import { logActivity } from "../lib/activity";
import { z } from "zod";

const router: ExpressRouter = Router();

const contestFiltersSchema = paginationSchema.extend({
  status: z.enum(["UPCOMING", "LIVE", "ENDED"]).optional(),
  type: z.enum(["PUBLIC", "PRIVATE", "INSTITUTIONAL"]).optional(),
});

function buildContestVisibilityWhere(user: Express.Request["user"]) {
  if (!user || user.role !== "STUDENT") {
    return {};
  }

  return {
    OR: [
      { sectionId: null, audience: { none: {} } },
      { sectionId: { in: user.scope.sectionIds }, audience: { none: {} } },
      { audience: { some: { studentId: user.id } } },
    ],
  };
}

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
      AND: [
        ...(status ? [{ status: status as "UPCOMING" | "LIVE" | "ENDED" }] : []),
        ...(type ? [{ type: type as "PUBLIC" | "PRIVATE" | "INSTITUTIONAL" }] : []),
        buildContestVisibilityWhere(req.user),
      ],
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
        audience: { select: { studentId: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { registrations: true, problems: true } },
      },
    });
    if (!contest) throw new AppError("Contest not found", 404);
    if (
      req.user?.role === "STUDENT" &&
      contest.audience.length > 0 &&
      !contest.audience.some((entry) => entry.studentId === req.user?.id)
    ) {
      throw new AppError("Contest not found", 404);
    }
    if (
      req.user?.role === "STUDENT" &&
      contest.sectionId &&
      !req.user.scope.sectionIds.includes(contest.sectionId)
    ) {
      throw new AppError("Contest not found", 404);
    }

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
router.post("/", authenticate, requirePermission("contests:create"), validate(createContestSchema), async (req, res, next) => {
  try {
    const { problemIds, participantIds = [], ...rest } = req.body as { problemIds: string[]; participantIds?: string[]; [key: string]: unknown };
    if (typeof rest.sectionId === "string" && req.user!.role !== "SUPER_ADMIN" && req.user!.role !== "ADMIN") {
      const allowed = await canAccessSection(req.user!, rest.sectionId);
      if (!allowed) {
        throw new AppError("Forbidden", 403);
      }
    }

    if (participantIds.length > 0) {
      const eligibleStudents = await prisma.user.findMany({
        where: {
          id: { in: participantIds },
          role: "STUDENT",
          ...(typeof rest.sectionId === "string"
            ? { enrollments: { some: { sectionId: rest.sectionId } } }
            : {}),
        },
        select: { id: true },
      });

      if (eligibleStudents.length !== participantIds.length) {
        throw new AppError("Some selected students are outside the contest scope", 400);
      }
    }

    const contest = await prisma.contest.create({
      data: {
        ...(rest as { title: string; description: string; startTime: string; endTime: string; type?: "PUBLIC" | "PRIVATE" | "INSTITUTIONAL"; rules?: string }),
        createdById: req.user!.id,
        startTime: new Date(rest.startTime as string),
        endTime: new Date(rest.endTime as string),
        problems: {
          create: problemIds.map((id, idx) => ({ problemId: id, order: idx + 1, points: 100 })),
        },
        audience: participantIds.length
          ? {
              createMany: {
                data: participantIds.map((studentId) => ({ studentId })),
                skipDuplicates: true,
              },
            }
          : undefined,
        registrations: participantIds.length
          ? {
              createMany: {
                data: participantIds.map((userId) => ({ userId })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: { problems: { include: { problem: { select: { title: true, difficulty: true } } } } },
    });

    res.status(201).json({ success: true, data: contest });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/contests/:id
router.patch("/:id", authenticate, requirePermission("contests:create"), async (req, res, next) => {
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
    if (contest.endTime <= new Date()) throw new AppError("Contest registration window is closed", 400);
    const audienceCount = await prisma.contestAudience.count({ where: { contestId: contest.id } });
    if (audienceCount > 0) {
      const invited = await prisma.contestAudience.findUnique({
        where: { contestId_studentId: { contestId: contest.id, studentId: req.user!.id } },
      });
      if (!invited && req.user!.role === "STUDENT") {
        throw new AppError("You are not invited to this contest", 403);
      }
    }
    if (
      req.user!.role === "STUDENT" &&
      contest.sectionId &&
      !req.user!.scope.sectionIds.includes(contest.sectionId)
    ) {
      throw new AppError("Forbidden", 403);
    }

    const registration = await prisma.contestRegistration.upsert({
      where: { contestId_userId: { contestId: req.params.id, userId: req.user!.id } },
      update: {},
      create: { contestId: req.params.id, userId: req.user!.id },
    });

    await logActivity(req.user!.id, "contest.registered", { contestId: req.params.id });

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
    const invited = req.user
      ? await prisma.contestAudience.findUnique({
          where: { contestId_studentId: { contestId: req.params.id, studentId: req.user.id } },
        })
      : null;
    const audienceCount = await prisma.contestAudience.count({ where: { contestId: req.params.id } });

    // Only registered users can see problems for live/ended contests
    if (contest.status !== "UPCOMING" && req.user) {
      const reg = await prisma.contestRegistration.findUnique({
        where: { contestId_userId: { contestId: req.params.id, userId: req.user.id } },
      });
      if (!reg && req.user.role === "STUDENT") throw new AppError("You must be registered to view problems", 403);
    }
    if (req.user?.role === "STUDENT" && audienceCount > 0 && !invited) {
      throw new AppError("Forbidden", 403);
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
    if (contest.endTime <= new Date()) throw new AppError("Contest has already ended", 400);
    const audienceCount = await prisma.contestAudience.count({ where: { contestId } });
    if (audienceCount > 0) {
      const invited = await prisma.contestAudience.findUnique({
        where: { contestId_studentId: { contestId, studentId: req.user!.id } },
      });
      if (!invited && req.user!.role === "STUDENT") {
        throw new AppError("You are not invited to this contest", 403);
      }
    }
    if (!registration && req.user!.role === "STUDENT") throw new AppError("Not registered for this contest", 403);
    if (
      req.user!.role === "STUDENT" &&
      contest.sectionId &&
      !req.user!.scope.sectionIds.includes(contest.sectionId)
    ) {
      throw new AppError("Forbidden", 403);
    }

    const existingAttempt = await prisma.submission.findFirst({
      where: {
        contestId,
        problemId,
        userId: req.user!.id,
      },
      select: { id: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    if (existingAttempt) {
      throw new AppError("You have already attempted this problem in the contest", 409);
    }

    const submission = await prisma.submission.create({
      data: { userId: req.user!.id, problemId, code, language, status: "PENDING", contestId },
    });

    await submissionQueue.add("submission" as const, {
      submissionId: submission.id,
      userId: req.user!.id,
      problemId,
      source_code: code,
      language,
      contestId,
    });

    res.status(201).json({ success: true, data: { submissionId: submission.id, status: "PENDING" } });
  } catch (err) {
    next(err);
  }
});

export default router;
