import { Router } from "express";
import { prisma } from "@repo/database";
import { redis } from "../lib/redis";

const router = Router();
const CACHE_TTL = 300; // 5 minutes

// GET /api/leaderboard/global
router.get("/global", async (req, res, next) => {
  try {
    const { page = "1", limit = "50" } = req.query as { page?: string; limit?: string };
    const cacheKey = `leaderboard:global:${page}:${limit}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [entries, total] = await Promise.all([
      prisma.leaderboard.findMany({
        include: { user: { select: { id: true, name: true, avatar: true, githubUsername: true } } },
        orderBy: { totalPoints: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.leaderboard.count(),
    ]);

    const response = {
      success: true,
      data: entries,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /api/leaderboard/class/:classId
router.get("/class/:classId", async (req, res, next) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { batchId: req.params.classId },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);

    const entries = await prisma.leaderboard.findMany({
      where: { userId: { in: studentIds } },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { totalPoints: "desc" },
    });

    res.json({ success: true, data: entries.map((e, idx) => ({ ...e, classRank: idx + 1 })) });
  } catch (err) {
    next(err);
  }
});

// GET /api/leaderboard/department/:deptId
router.get("/department/:deptId", async (req, res, next) => {
  try {
    const deptBatches = await prisma.batch.findMany({
      where: { departmentId: req.params.deptId },
      select: { id: true },
    });
    const batchIds = deptBatches.map((b) => b.id);

    const enrollments = await prisma.enrollment.findMany({
      where: { batchId: { in: batchIds } },
      select: { studentId: true },
    });
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

    const entries = await prisma.leaderboard.findMany({
      where: { userId: { in: studentIds } },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { totalPoints: "desc" },
    });

    res.json({ success: true, data: entries.map((e, idx) => ({ ...e, deptRank: idx + 1 })) });
  } catch (err) {
    next(err);
  }
});

// GET /api/leaderboard/contest/:contestId
router.get("/contest/:contestId", async (req, res, next) => {
  try {
    const standings = await prisma.contestStanding.findMany({
      where: { contestId: req.params.contestId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: [{ rank: "asc" }, { totalScore: "desc" }],
    });
    res.json({ success: true, data: standings });
  } catch (err) {
    next(err);
  }
});

export default router;
