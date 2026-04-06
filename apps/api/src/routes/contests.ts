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
import {
  syncContestStatuses,
  getContestStandings,
  logTabSwitch,
  generateContestCertificates,
} from "../services/contest.service";
import { recomputeStudentIntelligence } from "../services/student-intelligence.service";
import { detectContestPlagiarism } from "../services/plagiarism.service";
import {
  buildContestViewerPayload,
  getContestRegistrationState,
  registerForContest,
} from "../services/event-registration.service";
import { assertStudentParticipationReadiness } from "../services/student-profile.service";

const router: ExpressRouter = Router();

const contestFiltersSchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "UPCOMING", "SCHEDULED", "REGISTRATION_OPEN", "LIVE", "FROZEN", "ENDED", "RESULTS_PUBLISHED"]).optional(),
  type: z.enum(["PUBLIC", "PRIVATE", "INSTITUTIONAL", "SUBJECT", "DEPARTMENT", "INSTITUTION"]).optional(),
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

    // Auto-update contest statuses via state machine
    await syncContestStatuses();

    const where = {
      AND: [
        ...(status ? [{ status: status as "UPCOMING" | "LIVE" | "ENDED" }] : []),
        ...(type ? [{ type: type as "PUBLIC" | "PRIVATE" | "INSTITUTIONAL" }] : []),
        buildContestVisibilityWhere(req.user),
      ],
    };

    const [contestsRaw, total] = await Promise.all([
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

    // Attach viewer registration state for authenticated users
    const contests = await Promise.all(
      contestsRaw.map(async (contest) => {
        if (!req.user) return { ...contest, registrationState: null };
        const registrationState = await getContestRegistrationState(contest.id, req.user.id);
        return { ...contest, registrationState };
      })
    );

    res.json({ success: true, data: contests, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/contests/:id - returns role-aware payload
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    // Use the canonical viewer payload builder when authenticated
    if (req.user) {
      const payload = await buildContestViewerPayload(req.params.id, req.user);
      return res.json({ success: true, data: payload });
    }

    // Unauthenticated - return basic info
    const contest = await prisma.contest.findUnique({
      where: { id: req.params.id },
      include: {
        audience: { select: { studentId: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { registrations: true, problems: true } },
      },
    });
    if (!contest) throw new AppError("Contest not found", 404);

    res.json({ success: true, data: { ...contest, isRegistered: false } });
  } catch (err) {
    next(err);
  }
});

// POST /api/contests - create contest
router.post("/", authenticate, requirePermission("contests:create"), validate(createContestSchema), async (req, res, next) => {
  try {
    const { problemIds, participantIds = [], ...rest } = req.body as { problemIds: string[]; participantIds?: string[]; [key: string]: unknown };
    const actor = req.user!;
    const scope = rest.scope as "GLOBAL" | "DEPARTMENT" | "SECTION";
    const sectionId = typeof rest.sectionId === "string" ? rest.sectionId : null;
    const departmentId = typeof rest.departmentId === "string" ? rest.departmentId : null;
    const subjectId = typeof rest.subjectId === "string" ? rest.subjectId : null;

    if (actor.role === "TEACHER") {
      if (scope !== "SECTION" || !sectionId) {
        throw new AppError("Teachers can only create contests for an assigned section", 400);
      }
      if (!actor.scope.sectionIds.includes(sectionId)) {
        throw new AppError("Forbidden", 403);
      }
      if (subjectId) {
        const assignment = await prisma.teacherSubjectAssignment.findFirst({
          where: { teacherId: actor.id, sectionId, subjectId },
          select: { id: true },
        });
        if (!assignment) {
          throw new AppError("Teachers can only create contests for their assigned subject scope", 403);
        }
      }
    }

    if (actor.role === "CLASS_COORDINATOR") {
      if (scope !== "SECTION" || !sectionId || !actor.scope.sectionIds.includes(sectionId)) {
        throw new AppError("Class coordinators can only create contests for their section", 400);
      }
    }

    if (typeof sectionId === "string" && actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
      const allowed = await canAccessSection(actor, sectionId);
      if (!allowed) {
        throw new AppError("Forbidden", 403);
      }
    }

    if (actor.role === "DEPARTMENT_HEAD") {
      if (!departmentId || !actor.scope.departmentIds.includes(departmentId)) {
        throw new AppError("Department heads can only create contests for their department", 403);
      }
      if (scope === "GLOBAL") {
        throw new AppError("Department heads cannot create global contests", 403);
      }
    }

    if (participantIds.length > 0) {
      const eligibleStudents = await prisma.user.findMany({
        where: {
          id: { in: participantIds },
          role: "STUDENT",
          ...(typeof sectionId === "string"
            ? { enrollments: { some: { sectionId } } }
            : departmentId
            ? { enrollments: { some: { section: { departmentId } } } }
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
        registrationEnd: typeof rest.registrationEnd === "string" ? new Date(rest.registrationEnd) : null,
        freezeTime: typeof rest.freezeTime === "string" ? new Date(rest.freezeTime) : null,
        departmentId,
        subjectId,
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

// POST /api/contests/:id/register — uses canonical service with registrationEnd enforcement
router.post("/:id/register", authenticate, async (req, res, next) => {
  try {
    if (req.user!.role !== "STUDENT") {
      throw new AppError("Only students can register for contests", 403);
    }
    await assertStudentParticipationReadiness(req.user!.id);
    const registration = await registerForContest(req.params.id, req.user!.id);
    await logActivity(req.user!.id, "contest.registered", { contestId: req.params.id });
    res.status(201).json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
});

// GET /api/contests/:id/standings - supports frozen leaderboard
router.get("/:id/standings", optionalAuth, async (req, res, next) => {
  try {
    const isStaff = req.user?.role !== "STUDENT";
    const standings = await getContestStandings(req.params.id, req.user?.id, isStaff);
    res.json({ success: true, data: standings });
  } catch (err) {
    next(err);
  }
});

// POST /api/contests/:id/tab-switch - log tab switch during contest
router.post("/:id/tab-switch", authenticate, async (req, res, next) => {
  try {
    const result = await logTabSwitch(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/contests/:id/plagiarism - post-contest plagiarism detection (P3.5)
router.get("/:id/plagiarism", authenticate, requirePermission("contests:create"), async (req, res, next) => {
  try {
    const { threshold } = req.query as { threshold?: string };
    const parsedThreshold = threshold ? parseFloat(threshold) : 0.75;

    const results = await detectContestPlagiarism(req.params.id, parsedThreshold);
    res.json({ success: true, data: results, totalFlagged: results.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/contests/:id/publish-results - publish results and generate certificates
router.post("/:id/publish-results", authenticate, requirePermission("contests:create"), async (req, res, next) => {
  try {
    const contest = await prisma.contest.findUnique({ where: { id: req.params.id } });
    if (!contest) throw new AppError("Contest not found", 404);
    if (contest.status !== "ENDED") throw new AppError("Contest must be ended before publishing results", 400);

    await prisma.contest.update({
      where: { id: req.params.id },
      data: { status: "RESULTS_PUBLISHED" },
    });

    await generateContestCertificates(req.params.id);
    const participantIds = await prisma.contestStanding.findMany({
      where: { contestId: req.params.id },
      select: { userId: true },
    });

    await Promise.allSettled(
      participantIds.map((participant) => recomputeStudentIntelligence(participant.userId))
    );

    res.json({ success: true, message: "Results published and certificates generated" });
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

    // Check if already accepted — no re-submission after AC
    const acceptedAttempt = await prisma.submission.findFirst({
      where: { contestId, problemId, userId: req.user!.id, status: "ACCEPTED" },
    });

    if (acceptedAttempt) {
      throw new AppError("You have already solved this problem in the contest", 409);
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
