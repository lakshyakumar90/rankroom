import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import {
  achievementInputSchema,
  profileSyncSchema,
  projectInputSchema,
  skillInputSchema,
  updateStudentProfileSchema,
} from "@repo/validators";
import { validate } from "../middleware/validate";
import { authenticate, optionalAuth } from "../middleware/auth";
import { requirePermission, requireScope } from "../middleware/permissions";
import {
  addAchievementController,
  addProjectController,
  addSkillController,
  deleteAchievementController,
  deleteProjectController,
  deleteResumeController,
  deleteSkillController,
  getProfileController,
  profileHeatmapController,
  syncProfileController,
  updateAchievementController,
  updateOwnProfileController,
  updateProjectController,
  updateSkillController,
  uploadResumeController,
} from "../controllers/profile.controller";
import { getStudentContext } from "../services/scope.service";

const router: ExpressRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/:userId", optionalAuth, getProfileController);
router.get("/:userId/heatmap", optionalAuth, profileHeatmapController);

router.put(
  "/",
  authenticate,
  requirePermission("profile:update:own"),
  validate(updateStudentProfileSchema),
  updateOwnProfileController
);
router.post(
  "/resume",
  authenticate,
  requirePermission("profile:update:own"),
  upload.single("file"),
  uploadResumeController
);
router.delete("/resume", authenticate, requirePermission("profile:update:own"), deleteResumeController);
router.post("/skills", authenticate, requirePermission("profile:update:own"), validate(skillInputSchema), addSkillController);
router.put("/skills/:skillId", authenticate, requirePermission("profile:update:own"), validate(skillInputSchema.partial()), updateSkillController);
router.delete("/skills/:skillId", authenticate, requirePermission("profile:update:own"), deleteSkillController);
router.post("/projects", authenticate, requirePermission("profile:update:own"), validate(projectInputSchema), addProjectController);
router.put("/projects/:id", authenticate, requirePermission("profile:update:own"), validate(projectInputSchema.partial()), updateProjectController);
router.delete("/projects/:id", authenticate, requirePermission("profile:update:own"), deleteProjectController);
router.post("/achievements", authenticate, requirePermission("profile:update:own"), validate(achievementInputSchema), addAchievementController);
router.put("/achievements/:id", authenticate, requirePermission("profile:update:own"), validate(achievementInputSchema.partial()), updateAchievementController);
router.delete("/achievements/:id", authenticate, requirePermission("profile:update:own"), deleteAchievementController);
router.post("/sync", authenticate, requirePermission("profile:update:own"), validate(profileSyncSchema), syncProfileController);

router.get(
  "/authority/:userId",
  authenticate,
  requireScope((req) => getStudentContext(req.params.userId)),
  getProfileController
);

export default router;
