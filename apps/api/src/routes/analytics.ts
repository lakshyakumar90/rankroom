import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "@repo/types";

const router = Router();
router.use(authenticate);

// GET /api/analytics/me - own analytics (student)
router.get("/me", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [leaderboard, submissionsByStatus, recentSubmissions, contestHistory, attendanceBySubject] = await Promise.all([
      prisma.leaderboard.findUnique({ where: { userId } }),
      prisma.submission.groupBy({ by: ["status"], where: { userId }, _count: true }),
      prisma.submission.findMany({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, status: true, problem: { select: { difficulty: true } } },
      }),
      prisma.contestStanding.findMany({
        where: { userId },
        include: { contest: { select: { title: true, startTime: true } } },
        orderBy: { contest: { startTime: "desc" } },
        take: 10,
      }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { studentId: userId },
        _count: true,
      }),
    ]);

    // Build submission heatmap (count per day)
    const heatmap: Record<string, number> = {};
    for (const s of recentSubmissions) {
      const day = s.createdAt.toISOString().split("T")[0]!;
      heatmap[day] = (heatmap[day] ?? 0) + 1;
    }

    res.json({
      success: true,
      data: { leaderboard, submissionsByStatus, heatmap, contestHistory, attendanceBySubject },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/class/:classId - class analytics (teacher/admin)
router.get("/class/:classId", requireRole(Role.TEACHER, Role.ADMIN), async (req, res, next) => {
  try {
    const batchId = req.params.classId;

    const [enrollments, attendanceSummary, gradeSummary, topStudents] = await Promise.all([
      prisma.enrollment.count({ where: { batchId } }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { attendance: { batchId } },
        _count: true,
      }),
      prisma.grade.aggregate({
        where: { subject: { batchId } },
        _avg: { marks: true },
        _max: { marks: true },
        _min: { marks: true },
      }),
      prisma.leaderboard.findMany({
        where: { user: { enrollments: { some: { batchId } } } },
        orderBy: { totalPoints: "desc" },
        take: 5,
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    res.json({
      success: true,
      data: { enrollments, attendanceSummary, gradeSummary, topStudents },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
