import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// GET /api/notifications
router.get("/", async (req, res, next) => {
  try {
    const { page = "1", limit = "20" } = req.query as { page?: string; limit?: string };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.notification.count({ where: { userId: req.user!.id } }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);

    res.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { isRead: true },
    });
    res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
});

export default router;
