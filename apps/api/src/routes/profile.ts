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
  deleteAvatarController,
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
  uploadAvatarController,
  uploadResumeController,
} from "../controllers/profile.controller";
import { getStudentContext } from "../services/scope.service";
import { prisma } from "@repo/database";
import { updateBasicProfile } from "../services/student-profile.service";

const router: ExpressRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Static routes MUST come before /:userId ─────────────────────────────────

router.put(
  "/",
  authenticate,
  requirePermission("profile:update:own"),
  validate(updateStudentProfileSchema),
  updateOwnProfileController
);

// PATCH /api/profile/update — shorthand for profile + social fields
router.patch("/update", authenticate, requirePermission("profile:update:own"), async (req, res, next) => {
  try {
    const { name, bio, handle, githubUsername, isPublic, phoneNumber } = req.body as {
      name?: string;
      bio?: string;
      handle?: string;
      githubUsername?: string;
      isPublic?: boolean;
      phoneNumber?: string;
    };
    const updated = await updateBasicProfile(req.user!.id, {
      name,
      bio,
      handle,
      githubUsername,
      isPublic,
      phoneNumber,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Resume
router.post(
  "/resume",
  authenticate,
  requirePermission("profile:update:own"),
  upload.single("file"),
  uploadResumeController
);
router.delete("/resume", authenticate, requirePermission("profile:update:own"), deleteResumeController);
router.post("/avatar", authenticate, requirePermission("profile:update:own"), upload.single("file"), uploadAvatarController);
router.delete("/avatar", authenticate, requirePermission("profile:update:own"), deleteAvatarController);

// Skills
router.get("/skills", authenticate, async (req, res, next) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: { skills: true },
    });
    res.json({ success: true, data: profile?.skills ?? [] });
  } catch (err) {
    next(err);
  }
});
router.post("/skills", authenticate, requirePermission("profile:update:own"), validate(skillInputSchema), addSkillController);
router.put("/skills/:skillId", authenticate, requirePermission("profile:update:own"), validate(skillInputSchema.partial()), updateSkillController);
router.delete("/skills/:skillId", authenticate, requirePermission("profile:update:own"), deleteSkillController);

// Teaching assignments (for teacher settings panel)
router.get("/teaching-assignments", authenticate, async (req, res, next) => {
  try {
    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: { teacherId: req.user!.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true, code: true, academicYear: true } },
      },
    });
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
});

// Projects
router.post("/projects", authenticate, requirePermission("profile:update:own"), validate(projectInputSchema), addProjectController);
router.put("/projects/:id", authenticate, requirePermission("profile:update:own"), validate(projectInputSchema.partial()), updateProjectController);
router.delete("/projects/:id", authenticate, requirePermission("profile:update:own"), deleteProjectController);

// Achievements
router.post("/achievements", authenticate, requirePermission("profile:update:own"), validate(achievementInputSchema), addAchievementController);
router.put("/achievements/:id", authenticate, requirePermission("profile:update:own"), validate(achievementInputSchema.partial()), updateAchievementController);
router.delete("/achievements/:id", authenticate, requirePermission("profile:update:own"), deleteAchievementController);

// Sync
router.post("/sync", authenticate, requirePermission("profile:update:own"), validate(profileSyncSchema), syncProfileController);

// Authority access (staff viewing a specific student)
router.get(
  "/authority/:userId",
  authenticate,
  requireScope((req) => getStudentContext(req.params.userId)),
  getProfileController
);

// ─── Dynamic routes MUST come last ───────────────────────────────────────────
router.get("/:userId/heatmap", optionalAuth, profileHeatmapController);
router.get("/:userId", optionalAuth, getProfileController);

export default router;
