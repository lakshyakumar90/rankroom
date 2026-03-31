import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/auth";
import { requirePermission, requireScope } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import { createSectionSchema, updateSectionSchema } from "@repo/validators";
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
router.get("/:id/students", requireScope((req) => ({ sectionId: req.params.id })), sectionStudentsController);
router.get("/:id/teachers", requireScope((req) => ({ sectionId: req.params.id })), sectionTeachersController);
router.get("/:id/attendance", requireScope((req) => ({ sectionId: req.params.id })), sectionAttendanceController);
router.get("/:id/leaderboard", requireScope((req) => ({ sectionId: req.params.id })), sectionLeaderboardController);
router.get("/:id/assignments", requireScope((req) => ({ sectionId: req.params.id })), sectionAssignmentsController);

export default router;
