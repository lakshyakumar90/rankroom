import { Router, type Router as ExpressRouter } from "express";
import { validate } from "../middleware/validate";
import { attendanceSessionUpsertSchema } from "@repo/validators";
import { authenticate } from "../middleware/auth";
import { requirePermission, requireScope } from "../middleware/permissions";
import { prisma } from "@repo/database";
import {
  createAttendanceSessionController,
  getAttendanceSessionController,
  getLowAttendanceController,
  getSectionSubjectSummaryController,
  getStudentAttendanceController,
  updateAttendanceSessionController,
} from "../controllers/attendance.controller";
import { getStudentContext } from "../services/scope.service";
import {
  getAttendanceSession,
  getStudentSubjectAttendance,
  getStudentOverallAttendance,
} from "../services/attendance.service";
import { AppError } from "../middleware/error";
import { z } from "zod";

const router: ExpressRouter = Router();
router.use(authenticate);

const submitExcuseSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

const reviewExcuseSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

function normalizeAttendancePayload(body: Record<string, unknown>) {
  const sectionId = typeof body.sectionId === "string" ? body.sectionId : typeof body.batchId === "string" ? body.batchId : undefined;
  return {
    ...body,
    sectionId,
  };
}

router.post(
  ["/", "/session"],
  requirePermission("attendance:create"),
  (req, _res, next) => {
    req.body = normalizeAttendancePayload(req.body as Record<string, unknown>);
    next();
  },
  validate(attendanceSessionUpsertSchema),
  requireScope((req) => ({
    sectionId: req.body.sectionId,
    subjectId: req.body.subjectId,
  })),
  createAttendanceSessionController
);

router.put(
  ["/:sessionId", "/session/:sessionId"],
  requirePermission("attendance:update"),
  (req, _res, next) => {
    req.body = normalizeAttendancePayload(req.body as Record<string, unknown>);
    next();
  },
  validate(attendanceSessionUpsertSchema),
  requireScope(async (req) => {
    const session = await getAttendanceSession(req.params.sessionId);
    return {
      sectionId: session?.sectionId ?? req.body.sectionId,
      departmentId: session?.section?.departmentId,
      subjectId: session?.subjectId ?? req.body.subjectId,
    };
  }),
  updateAttendanceSessionController
);

router.get(
  "/session/:sessionId",
  requireScope(async (req) => {
    const session = await getAttendanceSession(req.params.sessionId);
    return {
      sectionId: session?.sectionId,
      departmentId: session?.section?.departmentId,
      subjectId: session?.subjectId,
    };
  }),
  getAttendanceSessionController
);

router.post("/records/:recordId/excuse", validate(submitExcuseSchema), async (req, res, next) => {
  try {
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: req.params.recordId },
      include: { attendanceSession: { include: { section: true } } },
    });

    if (!record) throw new AppError("Attendance record not found", 404);
    if (record.studentId !== req.user!.id) throw new AppError("Students can only submit excuses for their own attendance", 403);
    if (record.status === "PRESENT") throw new AppError("Excuses are only needed for absent or late records", 400);

    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        excuseStatus: "PENDING",
        excuseReason: req.body.reason,
        excuseSubmittedAt: new Date(),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/records/:recordId/excuse",
  requirePermission("attendance:update"),
  validate(reviewExcuseSchema),
  requireScope(async (req) => {
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: req.params.recordId },
      include: { attendanceSession: { include: { section: true } } },
    });

    return {
      ownerId: record?.studentId,
      sectionId: record?.attendanceSession.sectionId,
      departmentId: record?.attendanceSession.section.departmentId,
      subjectId: record?.attendanceSession.subjectId,
    };
  }),
  async (req, res, next) => {
    try {
      const status = req.body.status as "APPROVED" | "REJECTED";
      const updated = await prisma.attendanceRecord.update({
        where: { id: req.params.recordId },
        data: {
          excuseStatus: status,
          excuseReviewedAt: new Date(),
          excuseReviewedById: req.user!.id,
          ...(status === "APPROVED" ? { status: "PRESENT" } : {}),
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/student/:studentId",
  requireScope((req) => getStudentContext(req.params.studentId)),
  getStudentAttendanceController
);

router.get(
  "/section/:sectionId/subject/:subjectId/summary",
  requireScope((req) => ({
    sectionId: req.params.sectionId,
    subjectId: req.params.subjectId,
  })),
  getSectionSubjectSummaryController
);

router.get(
  "/section/:sectionId/low-attendance",
  requireScope((req) => ({ sectionId: req.params.sectionId })),
  getLowAttendanceController
);

// GET /api/attendance/student/:studentId/percentage
router.get("/student/:studentId/percentage", async (req, res, next) => {
  try {
    const user = req.user!;
    const targetStudentId = req.params.studentId;
    const { subjectId } = req.query as { subjectId?: string };

    const isSelf = user.id === targetStudentId;
    const isStaff = ["ADMIN", "SUPER_ADMIN", "DEPARTMENT_HEAD", "CLASS_COORDINATOR", "TEACHER"].includes(user.role);

    if (!isSelf && !isStaff) {
      throw new AppError("Forbidden", 403);
    }

    if (subjectId) {
      const result = await getStudentSubjectAttendance(targetStudentId, subjectId);
      res.json({ success: true, data: result });
    } else {
      const result = await getStudentOverallAttendance(targetStudentId);
      const THRESHOLD = 75;
      res.json({
        success: true,
        data: {
          ...result,
          isBelowThreshold: result.percentage < THRESHOLD,
          threshold: THRESHOLD,
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
