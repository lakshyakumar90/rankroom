import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { Role } from "@repo/types";
import { authenticate, canAccessSection } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { requirePermission } from "../middleware/permissions";
import { getPlatformLeaderboard, getStudentLeaderboardSummary } from "../services/leaderboard.service";
import { getStudentSkillAnalyticsForViewer, recomputeStudentIntelligence } from "../services/student-intelligence.service";

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

// Student performance for CC/admin/dept-head panel
router.get("/student/:studentId", async (req, res, next) => {
  try {
    const viewer = req.user!;
    const { studentId } = req.params;
    const sectionId = req.query.sectionId as string | undefined;

    // Only staff can view other students' performance
    if (viewer.role === Role.STUDENT && viewer.id !== studentId) {
      throw new AppError("Forbidden", 403);
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        studentProfile: {
          select: {
            cgpa: true,
            leetcodeSolved: true,
            githubContributions: true,
            skills: { select: { name: true, level: true }, take: 15 },
          },
        },
        leaderboard: {
          select: { totalPoints: true, rank: true },
        },
      },
    });

    if (!student) throw new AppError("Student not found", 404);

    // Attendance summary (all sections or specific section)
    const attendanceWhere = sectionId
      ? { studentId, sectionId }
      : { studentId };

    const [attendanceRecords, grades, recentSubmissions] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: attendanceWhere,
        select: { status: true },
      }),
      prisma.grade.findMany({
        where: { studentId, ...(sectionId ? { subject: { sectionId } } : {}) },
        include: { subject: { select: { name: true, code: true, sectionId: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.submission.findMany({
        where: { userId: studentId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        include: { problem: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Build attendance summary
    const present = attendanceRecords.filter((r) => r.status === "PRESENT").length;
    const absent = attendanceRecords.filter((r) => r.status === "ABSENT").length;
    const late = attendanceRecords.filter((r) => r.status === "LATE").length;
    const total = attendanceRecords.length;
    const percentage = total > 0 ? ((present + late * 0.5) / total) * 100 : 0;

    // Group grades by subject and compute percentages
    const subjectMap = new Map<string, { name: string; code: string; obtained: number; max: number }>();
    for (const g of grades) {
      const key = g.subject.code;
      const existing = subjectMap.get(key) ?? { name: g.subject.name, code: g.subject.code, obtained: 0, max: 0 };
      existing.obtained += g.marks;
      existing.max += g.maxMarks;
      subjectMap.set(key, existing);
    }

    const gradesSummary = [...subjectMap.values()].map((s) => ({
      subjectName: s.name,
      subjectCode: s.code,
      obtained: s.obtained,
      maxMarks: s.max,
      percentage: s.max > 0 ? (s.obtained / s.max) * 100 : 0,
    }));

    res.json({
      success: true,
      data: {
        profile: {
          ...student,
          leaderboard: student.leaderboard
            ? {
                totalScore: student.leaderboard.totalPoints,
                rank: student.leaderboard.rank,
                // Keep legacy response key while sourcing from current leaderboard model.
                codingXP: student.leaderboard.totalPoints,
              }
            : null,
        },
        skillGraph: await getStudentSkillAnalyticsForViewer(viewer, studentId),
        attendance: total > 0 ? { present, absent, late, percentage: Math.round(percentage * 10) / 10 } : undefined,
        grades: gradesSummary,
        recentSubmissions: recentSubmissions.map((s) => ({
          id: s.id,
          problemTitle: s.problem.title,
          status: s.status,
          language: s.language,
          createdAt: s.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/student/:studentId/skills", async (req, res, next) => {
  try {
    const days = Number.parseInt((req.query.days as string | undefined) ?? "30", 10);
    const data = await getStudentSkillAnalyticsForViewer(req.user!, req.params.studentId, Number.isFinite(days) ? days : 30);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [leaderboardSummary, studentProfile, submissionsByStatus, recentSubmissions, contestHistory, attendanceByStatus] =
      await Promise.all([
        getStudentLeaderboardSummary(userId),
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
        leaderboard: leaderboardSummary.student
          ? {
              totalPoints: leaderboardSummary.points,
              rank: leaderboardSummary.global?.rank ?? null,
              sectionRank: leaderboardSummary.sectionRank,
              departmentRank: leaderboardSummary.departmentRank,
              problemsSolved: leaderboardSummary.solved,
              contestsParticipated: contestHistory.length,
              currentStreak: leaderboardSummary.streak,
            }
          : null,
        studentSummary: leaderboardSummary,
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

router.get("/me/skills", async (req, res, next) => {
  try {
    const days = Number.parseInt((req.query.days as string | undefined) ?? "30", 10);
    await recomputeStudentIntelligence(req.user!.id).catch(() => undefined);
    const data = await getStudentSkillAnalyticsForViewer(req.user!, req.user!.id, Number.isFinite(days) ? days : 30);
    res.json({ success: true, data });
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
        getPlatformLeaderboard(1, 10),
      ]);

    res.json({
      success: true,
      data: {
        departmentsCount,
        sectionsCount,
        studentsCount,
        teachersCount,
        activeContests,
        topLeaderboard: topLeaderboard.items,
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

// GET /api/analytics/section/:sectionId/at-risk — P3.4 predictive at-risk detection
router.get("/section/:sectionId/at-risk", async (req, res, next) => {
  try {
    await ensureSectionAnalyticsAccess(req.user!, req.params.sectionId);

    const { sectionId } = req.params;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const atRiskAssignmentLimit = 10;

    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId },
      select: {
        studentId: true,
        student: { select: { id: true, name: true, avatar: true, email: true } },
      },
    });

    const studentIds = enrollments.map((e) => e.studentId);

    const [attendanceData, submissionData, assignmentData, gradeData] = await Promise.all([
      // Attendance in last 30 days
      prisma.attendanceRecord.groupBy({
        by: ["studentId", "status"],
        where: { studentId: { in: studentIds }, attendanceSession: { sectionId, date: { gte: thirtyDaysAgo } } },
        _count: true,
      }),
      // Submissions in last 30 days
      prisma.submission.groupBy({
        by: ["userId", "status"],
        where: { userId: { in: studentIds }, createdAt: { gte: thirtyDaysAgo } },
        _count: true,
      }),
      // Overdue/missing assignment submissions from the past two weeks
      prisma.assignment.findMany({
        where: {
          subject: { sectionId },
          dueDate: { gte: fourteenDaysAgo, lte: now },
          status: { in: ["ACTIVE", "DEADLINE_EXPIRED"] },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          audience: { where: { studentId: { in: studentIds } }, select: { studentId: true } },
          submissions: {
            where: { studentId: { in: studentIds }, status: { not: "PENDING" } },
            select: { studentId: true },
          },
        },
        orderBy: { dueDate: "desc" },
        take: atRiskAssignmentLimit,
      }),
      prisma.grade.findMany({
        where: { studentId: { in: studentIds }, subject: { sectionId } },
        select: { studentId: true, marks: true, maxMarks: true },
      }),
    ]);

    // Build per-student attendance stats
    const attMap = new Map<string, { present: number; total: number }>();
    for (const row of attendanceData) {
      const entry = attMap.get(row.studentId) ?? { present: 0, total: 0 };
      const count = typeof row._count === "number" ? row._count : (row._count as { _all: number })._all ?? 0;
      entry.total += count;
      if (row.status === "PRESENT") entry.present += count;
      attMap.set(row.studentId, entry);
    }

    // Build per-student submission stats
    const subMap = new Map<string, { accepted: number; total: number }>();
    for (const row of submissionData) {
      const entry = subMap.get(row.userId) ?? { accepted: 0, total: 0 };
      const count = typeof row._count === "number" ? row._count : (row._count as { _all: number })._all ?? 0;
      entry.total += count;
      if (row.status === "ACCEPTED") entry.accepted += count;
      subMap.set(row.userId, entry);
    }

    // Build missing assignment map: studentId → count of overdue assignments with no submission
    const missingMap = new Map<string, number>();
    for (const assignment of assignmentData) {
      const assignedIds = new Set(
        assignment.audience.length > 0 ? assignment.audience.map((a) => a.studentId) : studentIds
      );
      const submittedIds = new Set(assignment.submissions.map((s) => s.studentId));
      for (const sid of assignedIds) {
        if (!submittedIds.has(sid)) {
          missingMap.set(sid, (missingMap.get(sid) ?? 0) + 1);
        }
      }
    }

    const gradeMap = new Map<string, { marks: number; maxMarks: number }>();
    for (const grade of gradeData) {
      const entry = gradeMap.get(grade.studentId) ?? { marks: 0, maxMarks: 0 };
      entry.marks += Number(grade.marks);
      entry.maxMarks += Number(grade.maxMarks);
      gradeMap.set(grade.studentId, entry);
    }

    const atRiskStudents = enrollments
      .map((enrollment) => {
        const att = attMap.get(enrollment.studentId) ?? { present: 0, total: 0 };
        const sub = subMap.get(enrollment.studentId) ?? { accepted: 0, total: 0 };
        const missedAssignments = missingMap.get(enrollment.studentId) ?? 0;
        const gradeStats = gradeMap.get(enrollment.studentId) ?? { marks: 0, maxMarks: 0 };

        const attendancePct = att.total > 0 ? Math.round((att.present / att.total) * 100) : null;
        const submissionActivity = sub.total;
        const acceptanceRate = sub.total > 0 ? Math.round((sub.accepted / sub.total) * 100) : 0;
        const compositeScore = gradeStats.maxMarks > 0 ? Math.round((gradeStats.marks / gradeStats.maxMarks) * 100) : null;

        // Risk score: 0-100
        const riskFactors: string[] = [];
        let riskScore = 0;

        if (attendancePct !== null && attendancePct < 75) {
          riskScore += 35;
          riskFactors.push(`Low attendance: ${attendancePct}%`);
        }

        if (submissionActivity === 0) {
          riskScore += 30;
          riskFactors.push("No coding activity in 30 days");
        } else if (submissionActivity < 3) {
          riskScore += 15;
          riskFactors.push("Very low coding activity");
        }

        if (missedAssignments >= 2) {
          riskScore += 25;
          riskFactors.push(`${missedAssignments} unsubmitted assignments in the past 2 weeks`);
        } else if (missedAssignments === 1) {
          riskScore += 12;
          riskFactors.push("1 unsubmitted assignment in the past 2 weeks");
        }

        if (compositeScore !== null && compositeScore < 40) {
          riskScore += 25;
          riskFactors.push(`Composite score below passing threshold: ${compositeScore}%`);
        }

        if (acceptanceRate < 20 && sub.total >= 5) {
          riskScore += 10;
          riskFactors.push(`Low acceptance rate: ${acceptanceRate}%`);
        }

        return {
          student: enrollment.student,
          riskScore: Math.min(100, riskScore),
          riskFactors,
          attendancePct,
          submissionActivity,
          acceptanceRate,
          missedAssignments,
          compositeScore,
          isAtRisk: riskScore >= 30,
        };
      })
      .filter((s) => s.isAtRisk)
      .sort((a, b) => b.riskScore - a.riskScore);

    res.json({ success: true, data: { atRiskStudents, totalStudents: enrollments.length } });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/department/:departmentId/overview — P3.3 role-specific dashboard
router.get("/department/:departmentId/overview", async (req, res, next) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "DEPARTMENT_HEAD"].includes(user.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    const { departmentId } = req.params;

    const [sections, totalStudents, avgAttendance, contestsThisMonth, topProblems] = await Promise.all([
      prisma.section.count({ where: { departmentId } }),
      prisma.enrollment.count({ where: { section: { departmentId } } }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { attendanceSession: { section: { departmentId } } },
        _count: true,
      }),
      prisma.contest.count({
        where: {
          departmentId,
          startTime: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.submission.groupBy({
        by: ["problemId"],
        where: { problem: { departmentId }, status: "ACCEPTED" },
        _count: true,
        orderBy: { _count: { problemId: "desc" } },
        take: 5,
      }),
    ]);

    const present = avgAttendance.find((r) => r.status === "PRESENT")?._count ?? 0;
    const total = avgAttendance.reduce((acc, r) => acc + r._count, 0);

    res.json({
      success: true,
      data: {
        sections,
        totalStudents,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
        contestsThisMonth,
        topProblems,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
