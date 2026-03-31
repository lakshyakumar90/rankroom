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

export default router;
