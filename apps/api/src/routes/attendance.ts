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
import { getAttendanceSession } from "../services/attendance.service";

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

export default router;
