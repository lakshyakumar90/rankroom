import { Router, type Router as ExpressRouter } from "express";
import { authenticate, optionalAuth } from "../middleware/auth";
import { requirePermission, requireScope } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import { createDepartmentSchema, updateDepartmentSchema } from "@repo/validators";
import {
  createDepartmentController,
  deleteDepartmentController,
  departmentAnalyticsController,
  departmentLeaderboardController,
  departmentMembersController,
  departmentSectionsController,
  listDepartmentsController,
  updateDepartmentController,
} from "../controllers/department.controller";
import {
  getDepartmentTeachers,
  getDepartmentStudents,
  getDepartmentContests,
  getDepartmentHackathons,
  getDepartmentDashboard,
} from "../services/department.service";

const router: ExpressRouter = Router();

router.get("/", optionalAuth, listDepartmentsController);
router.post("/", requirePermission("departments:create"), validate(createDepartmentSchema), createDepartmentController);
router.put(
  "/:id",
  authenticate,
  requirePermission("departments:update"),
  requireScope((req) => ({ departmentId: req.params.id })),
  validate(updateDepartmentSchema),
  updateDepartmentController
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("departments:delete"),
  requireScope((req) => ({ departmentId: req.params.id })),
  deleteDepartmentController
);
router.get("/:id/sections", authenticate, requireScope((req) => ({ departmentId: req.params.id })), departmentSectionsController);
router.get("/:id/members", authenticate, requireScope((req) => ({ departmentId: req.params.id })), departmentMembersController);
router.get(
  "/:id/analytics",
  authenticate,
  requirePermission("analytics:department"),
  requireScope((req) => ({ departmentId: req.params.id })),
  departmentAnalyticsController
);
router.get("/:id/leaderboard", authenticate, requireScope((req) => ({ departmentId: req.params.id })), departmentLeaderboardController);

// ── Extended department dashboard endpoints ───────────────────────────────────
router.get("/:id/dashboard", authenticate, requireScope((req) => ({ departmentId: req.params.id })), async (req, res, next) => {
  try {
    const data = await getDepartmentDashboard(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get("/:id/teachers", authenticate, requireScope((req) => ({ departmentId: req.params.id })), async (req, res, next) => {
  try {
    const teachers = await getDepartmentTeachers(req.params.id);
    res.json({ success: true, data: teachers });
  } catch (err) { next(err); }
});

router.get("/:id/students", authenticate, requireScope((req) => ({ departmentId: req.params.id })), async (req, res, next) => {
  try {
    const { search } = req.query as { search?: string };
    const students = await getDepartmentStudents(req.params.id, search);
    res.json({ success: true, data: students });
  } catch (err) { next(err); }
});

router.get("/:id/contests", authenticate, requireScope((req) => ({ departmentId: req.params.id })), async (req, res, next) => {
  try {
    const contests = await getDepartmentContests(req.params.id);
    res.json({ success: true, data: contests });
  } catch (err) { next(err); }
});

router.get("/:id/hackathons", authenticate, requireScope((req) => ({ departmentId: req.params.id })), async (req, res, next) => {
  try {
    const hackathons = await getDepartmentHackathons(req.params.id);
    res.json({ success: true, data: hackathons });
  } catch (err) { next(err); }
});

export default router;
