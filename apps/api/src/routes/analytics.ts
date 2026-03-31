import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { Role } from "@repo/types";
import { authenticate, canAccessSection } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { requirePermission } from "../middleware/permissions";

const router: ExpressRouter = Router();
router.use(authenticate);

async function resolveSectionId(reqSectionId?: string, reqClassId?: string) {
  return reqSectionId ?? reqClassId ?? null;
}

async function ensureSectionAnalyticsAccess(
  user: NonNullable<Express.Request["user"]>,
  sectionId: string
) {
  if (user.role === Role.STUDENT) {
    throw new AppError("Students can only view their own analytics", 403);
  }

  const allowed = await canAccessSection(user, sectionId);
  if (!allowed) {
    throw new AppError("Forbidden", 403);
  }
}

async function ensureSubjectAnalyticsAccess(
  user: NonNullable<Express.Request["user"]>,
  subjectId: string
) {
  if (user.role === Role.STUDENT) {
    throw new AppError("Students can only view their own analytics", 403);
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { sectionId: true },
  });

  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  const allowed = await canAccessSection(user, subject.sectionId, subjectId);
  if (!allowed) {
    throw new AppError("Forbidden", 403);
  }
}

router.get("/me", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [leaderboard, studentProfile, submissionsByStatus, recentSubmissions, contestHistory, attendanceByStatus] =
      await Promise.all([
        prisma.leaderboard.findUnique({ where: { userId } }),
        prisma.studentProfile.findUnique({ where: { userId } }),
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

    const heatmap: Record<string, number> = {};
    for (const submission of recentSubmissions) {
      const day = submission.createdAt.toISOString().split("T")[0]!;
      heatmap[day] = (heatmap[day] ?? 0) + 1;
    }

    res.json({
      success: true,
      data: {
        leaderboard,
        studentProfile,
        submissionsByStatus,
        attendanceByStatus,
        heatmap,
        contestHistory,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/platform", requirePermission("analytics:platform"), async (_req, res, next) => {
  try {
    const [departmentsCount, sectionsCount, studentsCount, teachersCount, activeContests, topLeaderboard] =
      await Promise.all([
        prisma.department.count(),
        prisma.section.count(),
        prisma.user.count({ where: { role: Role.STUDENT } }),
        prisma.user.count({ where: { role: { in: [Role.TEACHER, Role.CLASS_COORDINATOR, Role.DEPARTMENT_HEAD] } } }),
        prisma.contest.count({ where: { status: { in: ["UPCOMING", "LIVE"] } } }),
        prisma.leaderboard.findMany({
          include: {
            user: { select: { id: true, name: true, avatar: true, role: true } },
          },
          orderBy: { totalPoints: "desc" },
          take: 10,
        }),
      ]);

    res.json({
      success: true,
      data: {
        departmentsCount,
        sectionsCount,
        studentsCount,
        teachersCount,
        activeContests,
        topLeaderboard,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get(["/section/:sectionId", "/class/:classId"], async (req, res, next) => {
  try {
    const sectionId = await resolveSectionId(req.params.sectionId, req.params.classId);
    if (!sectionId) {
      throw new AppError("Section id is required", 400);
    }

    await ensureSectionAnalyticsAccess(req.user!, sectionId);

    const [section, enrollments, attendanceSummary, gradeSummary, assignmentSummary, topStudents] = await Promise.all([
      prisma.section.findUnique({
        where: { id: sectionId },
        include: {
          department: { select: { id: true, name: true, code: true } },
          coordinator: { select: { id: true, name: true } },
        },
      }),
      prisma.enrollment.count({ where: { sectionId } }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { attendanceSession: { sectionId } },
        _count: true,
      }),
      prisma.grade.aggregate({
        where: { subject: { sectionId } },
        _avg: { marks: true, maxMarks: true },
        _max: { marks: true },
        _min: { marks: true },
        _count: { id: true },
      }),
      prisma.assignment.aggregate({
        where: { subject: { sectionId } },
        _count: { id: true },
      }),
      prisma.sectionLeaderboard.findMany({
        where: { sectionId },
        orderBy: [{ rank: "asc" }, { totalScore: "desc" }],
        take: 5,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    if (!section) {
      throw new AppError("Section not found", 404);
    }

    res.json({
      success: true,
      data: {
        section,
        enrollments,
        attendanceSummary,
        gradeSummary,
        assignmentSummary,
        topStudents,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/subject/:subjectId", async (req, res, next) => {
  try {
    await ensureSubjectAnalyticsAccess(req.user!, req.params.subjectId);

    const [subject, attendanceSummary, assignmentSummary, gradeSummary, enrolledStudents] =
      await Promise.all([
        prisma.subject.findUnique({
          where: { id: req.params.subjectId },
          include: {
            section: { select: { id: true, name: true, code: true, academicYear: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        }),
        prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { attendanceSession: { subjectId: req.params.subjectId } },
          _count: true,
        }),
        prisma.assignment.aggregate({
          where: { subjectId: req.params.subjectId },
          _count: { id: true },
        }),
        prisma.grade.aggregate({
          where: { subjectId: req.params.subjectId },
          _avg: { marks: true, maxMarks: true },
          _count: { id: true },
        }),
        prisma.enrollment.count({
          where: { section: { subjects: { some: { id: req.params.subjectId } } } },
        }),
      ]);

    if (!subject) {
      throw new AppError("Subject not found", 404);
    }

    res.json({
      success: true,
      data: {
        subject,
        attendanceSummary,
        assignmentSummary,
        gradeSummary,
        enrolledStudents,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
