import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error";

const router = Router();

// GET /api/users/:id/profile - public profile
router.get("/:id/profile", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: false,
        avatar: true,
        githubUsername: true,
        role: true,
        createdAt: true,
        profile: true,
        leaderboard: true,
      },
    });

    if (!user) throw new AppError("User not found", 404);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/search - search users (admin/teacher)
router.get("/search", authenticate, async (req, res, next) => {
  try {
    const { q, role, limit = "20" } = req.query as { q?: string; role?: string; limit?: string };

    const users = await prisma.user.findMany({
      where: {
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
        ...(role ? { role: role as "ADMIN" | "TEACHER" | "STUDENT" } : {}),
      },
      select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
      take: parseInt(limit),
    });

    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id/submissions - user's submissions
router.get("/:id/submissions", authenticate, async (req, res, next) => {
  try {
    const { page = "1", limit = "20" } = req.query as { page?: string; limit?: string };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where: { userId: req.params.id },
        include: { problem: { select: { title: true, slug: true, difficulty: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.submission.count({ where: { userId: req.params.id } }),
    ]);

    res.json({
      success: true,
      data: submissions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id/stats - user statistics
router.get("/:id/stats", async (req, res, next) => {
  try {
    const userId = req.params.id;

    const [leaderboard, submissionStats, recentSubmissions] = await Promise.all([
      prisma.leaderboard.findUnique({ where: { userId } }),
      prisma.submission.groupBy({
        by: ["status"],
        where: { userId },
        _count: true,
      }),
      prisma.submission.findMany({
        where: { userId, status: "ACCEPTED" },
        include: { problem: { select: { title: true, slug: true, difficulty: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    res.json({
      success: true,
      data: {
        leaderboard,
        submissionStats,
        recentSubmissions,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
