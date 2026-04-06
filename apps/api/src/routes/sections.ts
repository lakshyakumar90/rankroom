import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/auth";
import { requirePermission, requireScope } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import { createSectionSchema, updateSectionSchema } from "@repo/validators";
import { z } from "zod";
import { AppError } from "../middleware/error";
import {
  createSectionController,
  deleteSectionController,
  listSectionsController,
  sectionAssignmentsController,
  sectionAttendanceController,
  sectionLeaderboardController,
  sectionStudentsController,
  sectionTeachersController,
  updateSectionController,
} from "../controllers/section.controller";
import {
  assignCoordinator,
  removeCoordinator,
  getSectionCoordinators,
  assignTeacherToSubject,
  removeTeacherFromSubject,
  getSectionOverview,
} from "../services/section.service";
import { prisma } from "@repo/database";

const router: ExpressRouter = Router();

router.use(authenticate);

router.get("/", listSectionsController);
router.post("/", requirePermission("sections:create"), validate(createSectionSchema), createSectionController);
router.put(
  "/:id",
  requirePermission("sections:update"),
  requireScope((req) => ({ sectionId: req.params.id })),
  validate(updateSectionSchema),
  updateSectionController
);
router.delete(
  "/:id",
  requirePermission("sections:delete"),
  requireScope((req) => ({ sectionId: req.params.id })),
  deleteSectionController
);

// ── Section overview ──────────────────────────────────────────────────────────
router.get(
  "/:id",
  requireScope((req) => ({ sectionId: req.params.id })),
  async (req, res, next) => {
    try {
      const overview = await getSectionOverview(req.params.id);
      res.json({ success: true, data: overview });
    } catch (err) { next(err); }
  }
);

// ── Student roster ────────────────────────────────────────────────────────────
router.get("/:id/students", requireScope((req) => ({ sectionId: req.params.id })), sectionStudentsController);

// ── Teachers in section ───────────────────────────────────────────────────────
router.get("/:id/teachers", requireScope((req) => ({ sectionId: req.params.id })), sectionTeachersController);

// ── Attendance ────────────────────────────────────────────────────────────────
router.get("/:id/attendance", requireScope((req) => ({ sectionId: req.params.id })), sectionAttendanceController);

// ── Leaderboard ───────────────────────────────────────────────────────────────
router.get("/:id/leaderboard", requireScope((req) => ({ sectionId: req.params.id })), sectionLeaderboardController);

// ── Assignments ───────────────────────────────────────────────────────────────
router.get("/:id/assignments", requireScope((req) => ({ sectionId: req.params.id })), sectionAssignmentsController);

// ── Subjects list ─────────────────────────────────────────────────────────────
router.get(
  "/:id/subjects",
  requireScope((req) => ({ sectionId: req.params.id })),
  async (req, res, next) => {
    try {
      const teacherIdFilter = req.query.teacherId === "me" ? req.user?.id : (req.query.teacherId as string | undefined);

      const subjects = await prisma.subject.findMany({
        where: {
          sectionId: req.params.id,
          isArchived: false,
          // If teacherId is specified, only return subjects that teacher is assigned to
          ...(teacherIdFilter
            ? { teacherAssignments: { some: { teacherId: teacherIdFilter } } }
            : {}),
        },
        include: {
          teacherAssignments: { include: { teacher: { select: { id: true, name: true, email: true, avatar: true } } } },
          resultConfig: true,
          _count: { select: { grades: true, assignments: true } },
        },
        orderBy: { name: "asc" },
      });
      res.json({ success: true, data: subjects });
    } catch (err) { next(err); }
  }
);

// ── Contests in section ───────────────────────────────────────────────────────
router.get(
  "/:id/contests",
  requireScope((req) => ({ sectionId: req.params.id })),
  async (req, res, next) => {
    try {
      const contests = await prisma.contest.findMany({
        where: { sectionId: req.params.id },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { registrations: true, problems: true } },
        },
        orderBy: { startTime: "desc" },
      });
      res.json({ success: true, data: contests });
    } catch (err) { next(err); }
  }
);

// ── Hackathons in section's department ───────────────────────────────────────
router.get(
  "/:id/hackathons",
  requireScope((req) => ({ sectionId: req.params.id })),
  async (req, res, next) => {
    try {
      const section = await prisma.section.findUnique({
        where: { id: req.params.id },
        select: { departmentId: true },
      });
      if (!section) throw new AppError("Section not found", 404);
      const hackathons = await prisma.hackathon.findMany({
        where: { OR: [{ departmentId: section.departmentId }, { departmentId: null }] },
        include: {
          department: { select: { id: true, name: true } },
          _count: { select: { registrations: true, teams: true } },
        },
        orderBy: { startDate: "desc" },
      });
      res.json({ success: true, data: hackathons });
    } catch (err) { next(err); }
  }
);

// ── Coordinator management ────────────────────────────────────────────────────
router.get(
  "/:id/coordinators",
  requireScope((req) => ({ sectionId: req.params.id })),
  async (req, res, next) => {
    try {
      const coordinators = await getSectionCoordinators(req.params.id);
      res.json({ success: true, data: coordinators });
    } catch (err) { next(err); }
  }
);

const assignCoordinatorSchema = z.object({ body: z.object({ userId: z.string().min(1) }) });

router.post(
  "/:id/coordinators",
  requirePermission("sections:assign-coordinator"),
  requireScope((req) => ({ sectionId: req.params.id })),
  validate(assignCoordinatorSchema),
  async (req, res, next) => {
    try {
      const result = await assignCoordinator(req.params.id, req.body.userId as string, req.user!.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

router.delete(
  "/:id/coordinators/:userId",
  requirePermission("sections:assign-coordinator"),
  requireScope((req) => ({ sectionId: req.params.id })),
  async (req, res, next) => {
    try {
      await removeCoordinator(req.params.id, req.params.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

// ── Subject-teacher assignment ────────────────────────────────────────────────
const assignSubjectTeacherSchema = z.object({
  body: z.object({
    subjectId: z.string().min(1),
    teacherId: z.string().min(1),
  }),
});

router.post(
  "/:id/subject-assignments",
  requirePermission("sections:assign-teacher"),
  requireScope((req) => ({ sectionId: req.params.id })),
  validate(assignSubjectTeacherSchema),
  async (req, res, next) => {
    try {
      const result = await assignTeacherToSubject(
        req.params.id,
        req.body.subjectId as string,
        req.body.teacherId as string
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

router.delete(
  "/:id/subject-assignments",
  requirePermission("sections:assign-teacher"),
  requireScope((req) => ({ sectionId: req.params.id })),
  async (req, res, next) => {
    try {
      const { subjectId, teacherId } = req.query as { subjectId: string; teacherId: string };
      if (!subjectId || !teacherId) throw new AppError("subjectId and teacherId are required", 400);
      await removeTeacherFromSubject(req.params.id, subjectId, teacherId);
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

export default router;
