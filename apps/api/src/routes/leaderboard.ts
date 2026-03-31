import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/auth";
import { requirePermission, requireScope } from "../middleware/permissions";
import {
  departmentLeaderboardController,
  insightsController,
  platformLeaderboardController,
  recomputeLeaderboardController,
  sectionLeaderboardController,
} from "../controllers/leaderboard.controller";

const router: ExpressRouter = Router();

router.get("/section/:sectionId/insights", authenticate, requireScope((req) => ({ sectionId: req.params.sectionId })), insightsController);
router.get("/section/:sectionId", authenticate, requireScope((req) => ({ sectionId: req.params.sectionId })), sectionLeaderboardController);
router.get(
  "/department/:departmentId",
  authenticate,
  requireScope((req) => ({ departmentId: req.params.departmentId })),
  departmentLeaderboardController
);
router.get("/platform", authenticate, requirePermission("analytics:platform"), platformLeaderboardController);
router.post(
  "/recompute/:sectionId",
  authenticate,
  requirePermission("sections:update"),
  requireScope((req) => ({ sectionId: req.params.sectionId })),
  recomputeLeaderboardController
);

router.get("/global", authenticate, requirePermission("analytics:platform"), platformLeaderboardController);
router.get(
  "/class/:classId",
  authenticate,
  requireScope((req) => ({ sectionId: req.params.classId })),
  (req, res, next) => {
    req.params.sectionId = req.params.classId;
    return sectionLeaderboardController(req, res, next);
  }
);

export default router;
