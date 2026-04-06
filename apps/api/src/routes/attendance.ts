import { Router, type Router as ExpressRouter } from "express";
import { validate } from "../middleware/validate";
import { attendanceSessionUpsertSchema } from "@repo/validators";
import { authenticate } from "../middleware/auth";
import { requirePermission, requireScope } from "../middleware/permissions";
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

const router: ExpressRouter = Router();
router.use(authenticate);

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
