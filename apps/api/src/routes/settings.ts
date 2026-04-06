import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router: ExpressRouter = Router();
router.use(authenticate);

// GET /api/settings — get current user's settings
router.get("/", async (req, res, next) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user!.id },
    });

    // Return defaults if no settings row yet
    res.json({
      success: true,
      data: settings ?? {
        notificationsEnabled: true,
        emailDigest: false,
        contestReminders: true,
        hackathonReminders: true,
        assignmentReminders: true,
        attendanceAlerts: true,
        theme: null,
        publicProfileDefault: false,
      },
    });
  } catch (err) { next(err); }
});

// PATCH /api/settings — upsert user settings
router.patch("/", requirePermission("settings:update:own"), async (req, res, next) => {
  try {
    const allowed = [
      "notificationsEnabled",
      "emailDigest",
      "contestReminders",
      "hackathonReminders",
      "assignmentReminders",
      "attendanceAlerts",
      "theme",
      "publicProfileDefault",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in (req.body as Record<string, unknown>)) {
        data[key] = (req.body as Record<string, unknown>)[key];
      }
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: { userId: req.user!.id, ...data },
    });

    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

export default router;
