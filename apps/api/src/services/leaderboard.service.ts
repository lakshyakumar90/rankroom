import { prisma } from "@repo/database";
import { Role, type JWTPayload } from "@repo/types";
import { emitLeaderboardUpdated } from "../lib/socket";
import { AppError } from "../middleware/error";

const STUDENT_TOP_LIMIT = 10;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getSortMetric(
  entry: {
    totalScore: number;
    codingScore: number;
    cgpaScore: number;
    assignmentScore: number;
    hackathonScore: number;
    profileScore: number;
    externalScore: number;
  },
  filter: "overall" | "coding" | "academic" | "profile" | "external"
) {
  switch (filter) {
    case "coding":
      return entry.codingScore;
    case "academic":
      return entry.cgpaScore + entry.assignmentScore + entry.hackathonScore;
    case "profile":
      return entry.profileScore;
    case "external":
      return entry.externalScore;
    default:
      return entry.totalScore;
  }
}

function buildRestrictedLeaderboard<T extends { studentId?: string; userId?: string }>(
  items: T[],
  viewerId: string,
  pagination: { page: number; limit: number; total: number; totalPages: number }
) {
  const topItems = items.slice(0, 10);
  const self =
    items.find((item) => (("studentId" in item ? item.studentId : item.userId) ?? null) === viewerId) ?? null;

  return {
    items: topItems,
    self: self && !topItems.some((item) => item === self) ? self : null,
    pagination: {
      page: 1,
      limit: Math.min(STUDENT_TOP_LIMIT, pagination.total),
      total: pagination.total,
      totalPages: 1,
    },
    viewerMode: "restricted" as const,
  };
}

function getDerivedStreakScore(currentStreak: number | null | undefined) {
  return round2(clamp((currentStreak ?? 0) * 4, 0, 100) * 0.05);
}

function mapScopedLeaderboardEntry(
  entry: {
    studentId: string;
    rank: number | null;
    previousRank?: number | null;
    totalScore: number;
    codingScore: number;
    cgpaScore: number;
    assignmentScore: number;
    hackathonScore: number;
    profileScore: number;
    externalScore: number;
    updatedAt?: Date;
    lastComputedAt?: Date;
    section?: { id: string; name: string; code: string } | null;
    student: {
      id: string;
      name: string;
      avatar: string | null;
      role: string;
      createdAt: Date;
      email?: string;
      githubUsername?: string | null;
      profile?: { phoneNumber?: string | null } | null;
      studentProfile?: {
        currentStreak?: number;
        longestStreak?: number;
        lastActiveDate?: Date | null;
      } | null;
      leaderboard?: {
        problemsSolved?: number;
      } | null;
    };
  },
  rank: number
) {
  const currentStreak = entry.student.studentProfile?.currentStreak ?? 0;
  const longestStreak = entry.student.studentProfile?.longestStreak ?? 0;
  const streakScore = getDerivedStreakScore(currentStreak);

  return {
    userId: entry.studentId,
    studentId: entry.studentId,
    rank,
    previousRank: entry.previousRank ?? null,
    totalScore: round2(entry.totalScore),
    codingScore: round2(entry.codingScore),
    cgpaScore: round2(entry.cgpaScore),
    assignmentScore: round2(entry.assignmentScore),
    hackathonScore: round2(entry.hackathonScore),
    profileScore: round2(entry.profileScore),
    externalScore: round2(entry.externalScore),
    streakScore,
    currentStreak,
    longestStreak,
    lastActiveDate: entry.student.studentProfile?.lastActiveDate?.toISOString() ?? null,
    problemsSolved: entry.student.leaderboard?.problemsSolved ?? 0,
    student: {
      id: entry.student.id,
      name: entry.student.name,
      avatar: entry.student.avatar,
      role: entry.student.role,
      email: entry.student.email,
      githubUsername: entry.student.githubUsername ?? null,
      phoneNumber: entry.student.profile?.phoneNumber ?? null,
      createdAt: entry.student.createdAt.toISOString(),
    },
    section: entry.section ?? undefined,
    updatedAt: entry.updatedAt ?? entry.lastComputedAt ?? null,
  };
}

function sortScopedEntries<T extends {
  studentId?: string;
  rank?: number | null;
  previousRank?: number | null;
  totalScore: number;
  codingScore: number;
  cgpaScore: number;
  assignmentScore: number;
  hackathonScore: number;
  profileScore: number;
  externalScore: number;
  student: { name: string };
}>(entries: T[], filter: "overall" | "coding" | "academic" | "profile" | "external") {
  return [...entries].sort(
    (a, b) => getSortMetric(b, filter) - getSortMetric(a, filter) || a.student.name.localeCompare(b.student.name)
  );
}

function assignRanks(
  entries: Array<{
    studentId: string;
    rank: number | null;
    previousRank?: number | null;
    totalScore: number;
    codingScore: number;
    cgpaScore: number;
    assignmentScore: number;
    hackathonScore: number;
    profileScore: number;
    externalScore: number;
    updatedAt?: Date;
    lastComputedAt?: Date;
    section?: { id: string; name: string; code: string } | null;
    student: {
      id: string;
      name: string;
      avatar: string | null;
      createdAt: Date;
      role: string;
      email?: string;
      githubUsername?: string | null;
      profile?: { phoneNumber?: string | null } | null;
      studentProfile?: {
        currentStreak?: number;
        longestStreak?: number;
        lastActiveDate?: Date | null;
      } | null;
      leaderboard?: { problemsSolved?: number } | null;
    };
  }>,
  filter: "overall" | "coding" | "academic" | "profile" | "external"
) {
  return sortScopedEntries(entries, filter).map((entry, index) => mapScopedLeaderboardEntry(entry, index + 1));
}

async function getSectionStudents(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      enrollments: {
        include: {
          student: {
            include: {
              studentProfile: {
                include: {
                  skills: true,
                  projects: true,
                  achievements: true,
                },
              },
              leaderboard: true,
            },
          },
        },
      },
      subjects: {
        select: { id: true },
      },
    },
  });

  if (!section) throw new AppError("Section not found", 404);
  return section;
}

export async function recomputeSectionLeaderboard(sectionId: string) {
  const section = await getSectionStudents(sectionId);
  const studentIds = section.enrollments.map((enrollment) => enrollment.studentId);
  const subjectIds = section.subjects.map((subject) => subject.id);
  const totalProblems = await prisma.problem.count({ where: { isPublished: true } });
  const totalAssignments = await prisma.assignment.count({ where: { subjectId: { in: subjectIds } } });

  const [contestWins, gradeAverages, submissions, hackathonStats, attendanceData, contestParticipation, certificateBonus] = await Promise.all([
    prisma.contestStanding.groupBy({
      by: ["userId"],
      where: {
        userId: { in: studentIds },
        rank: 1,
      },
      _count: true,
    }),
    prisma.grade.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, subjectId: { in: subjectIds } },
      _avg: { marks: true, maxMarks: true },
    }),
    prisma.assignmentSubmission.groupBy({
      by: ["studentId"],
      where: {
        studentId: { in: studentIds },
        assignment: { subjectId: { in: subjectIds } },
      },
      _count: true,
      _avg: { score: true },
    }),
    prisma.hackathonRegistration.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        team: { select: { rank: true } },
      },
    }),
    // Attendance: count PRESENT records per student in this section
    prisma.attendanceRecord.groupBy({
      by: ["studentId", "status"],
      where: {
        studentId: { in: studentIds },
        attendanceSession: { sectionId },
      },
      _count: true,
    }),
    // Contest participation (all contests, not just wins)
    prisma.contestStanding.groupBy({
      by: ["userId"],
      where: { userId: { in: studentIds } },
      _count: true,
      _sum: { totalScore: true },
    }),

    // Approved certificate XP bonuses per student
    prisma.certificate.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, status: "APPROVED" },
      _sum: { xpBonus: true },
    }),
  ]);

  const contestWinMap = new Map(contestWins.map((entry) => [entry.userId, entry._count]));
  const gradeMap = new Map(
    gradeAverages.map((entry) => [
      entry.studentId,
      {
        avgMarks: entry._avg.marks ?? 0,
        avgMaxMarks: entry._avg.maxMarks ?? 100,
      },
    ])
  );
  const submissionMap = new Map(
    submissions.map((entry) => [
      entry.studentId,
      {
        submitted: entry._count,
        avgScore: entry._avg.score ?? 0,
      },
    ])
  );

  const hackathonMap = new Map<string, { registrations: number; wins: number; top3: number }>();
  for (const registration of hackathonStats) {
    if (!hackathonMap.has(registration.studentId)) {
      hackathonMap.set(registration.studentId, { registrations: 0, wins: 0, top3: 0 });
    }
    const row = hackathonMap.get(registration.studentId)!;
    row.registrations += 1;
    if (registration.team?.rank === 1) row.wins += 1;
    if ((registration.team?.rank ?? 999) <= 3) row.top3 += 1;
  }

  // Build attendance map: studentId → { present, absent, late, total }
  const attendanceMap = new Map<string, { present: number; total: number }>();
  for (const record of attendanceData) {
    const entry = attendanceMap.get(record.studentId) ?? { present: 0, total: 0 };
    const count = typeof record._count === "number" ? record._count : (record._count as { _all: number })._all ?? 0;
    entry.total += count;
    if (record.status === "PRESENT") entry.present += count;
    attendanceMap.set(record.studentId, entry);
  }

  // Build contest participation map: userId → { count, totalScore }
  const contestParticipationMap = new Map(contestParticipation.map((entry) => [
    entry.userId,
    { count: entry._count, totalScore: entry._sum.totalScore ?? 0 },
  ]));

  // Certificate XP bonus map: studentId → total approved XP
  const certBonusMap = new Map(
    certificateBonus.map((entry) => [entry.studentId, entry._sum.xpBonus ?? 0])
  );

  const rawExternalScores = section.enrollments.map((enrollment) => {
    const profile = enrollment.student.studentProfile;
    return (
      (profile?.leetcodeSolved ?? 0) * 0.5 +
      ((profile?.codechefRating ?? 0) / 100) +
      ((profile?.codeforcesRating ?? 0) / 100) +
      (profile?.githubContributions ?? 0) * 0.1
    );
  });
  const maxExternal = Math.max(...rawExternalScores, 0);

  const previousRanks = new Map(
    (
      await prisma.sectionLeaderboard.findMany({
        where: { sectionId },
        select: { studentId: true, rank: true },
      })
    ).map((entry) => [entry.studentId, entry.rank ?? null])
  );

  const nextEntries = section.enrollments.map((enrollment) => {
    const student = enrollment.student;
    const studentProfile = student.studentProfile;
    const coding = student.leaderboard;
    const gradeStats = gradeMap.get(student.id);
    const assignmentStats = submissionMap.get(student.id);
    const hackathonStatsForStudent = hackathonMap.get(student.id) ?? { registrations: 0, wins: 0, top3: 0 };

    const attendanceStats = attendanceMap.get(student.id) ?? { present: 0, total: 0 };
    const attendanceRate = attendanceStats.total > 0 ? attendanceStats.present / attendanceStats.total : 0;
    const attendanceScore = clamp(attendanceRate * 100) * 0.15;

    const contestStats = contestParticipationMap.get(student.id) ?? { count: 0, totalScore: 0 };

    // Rebalanced weights: CGPA 25%, Coding 20%, Assignment 15%, Hackathon 10%, Profile 5%, Attendance 15%, External 10%
    const cgpaRaw =
      studentProfile?.cgpa ??
      ((gradeStats?.avgMaxMarks ?? 0) > 0 ? ((gradeStats?.avgMarks ?? 0) / (gradeStats?.avgMaxMarks ?? 100)) * 10 : 0);
    const cgpaScore = clamp((cgpaRaw / 10) * 100) * 0.25;

    const codingBase =
      (totalProblems > 0 ? ((coding?.problemsSolved ?? 0) / totalProblems) * 50 : 0) +
      contestStats.count * 5 +
      (contestWinMap.get(student.id) ?? 0) * 20;
    const codingScore = clamp(codingBase) * 0.2;

    const avgGradePct =
      gradeStats && (gradeStats.avgMaxMarks ?? 0) > 0 ? (gradeStats.avgMarks / gradeStats.avgMaxMarks) * 100 : 0;
    const assignmentBase =
      (totalAssignments > 0 ? ((assignmentStats?.submitted ?? 0) / totalAssignments) * 50 : 0) +
      (avgGradePct / 100) * 50;
    const assignmentScore = clamp(assignmentBase) * 0.15;

    const hackathonBase =
      hackathonStatsForStudent.registrations * 5 +
      hackathonStatsForStudent.wins * 30 +
      hackathonStatsForStudent.top3 * 15;
    const hackathonScore = clamp(hackathonBase) * 0.1;

    const profileBase =
      (studentProfile?.skills.length ?? 0) * 3 +
      (studentProfile?.projects.length ?? 0) * 10 +
      (studentProfile?.achievements.length ?? 0) * 5 +
      (studentProfile?.resumeUrl ? 10 : 0) +
      (studentProfile?.githubUsername ? 5 : 0) +
      (studentProfile?.leetcodeUsername ? 5 : 0);
    const profileScore = clamp(profileBase) * 0.05;

    const externalRaw =
      (studentProfile?.leetcodeSolved ?? 0) * 0.5 +
      ((studentProfile?.codechefRating ?? 0) / 100) +
      ((studentProfile?.codeforcesRating ?? 0) / 100) +
      (studentProfile?.githubContributions ?? 0) * 0.1;
    const externalBase = maxExternal > 0 ? (externalRaw / maxExternal) * 100 : 0;
    const externalScore = clamp(externalBase) * 0.1;
    const streakScore = getDerivedStreakScore(studentProfile?.currentStreak);

    // Participation boost: students in contests or hackathons get up to +10% multiplier
    const participationEvents = (hackathonStatsForStudent.registrations + contestStats.count);
    const participationBoost = participationEvents > 0 ? Math.min(1.1, 1 + participationEvents * 0.02) : 1;

    // Certificate XP bonus — normalized to 0-10 points (cap at 1000 XP raw)
    const rawCertBonus = certBonusMap.get(student.id) ?? 0;
    const certScore = clamp((rawCertBonus / 1000) * 100) * 0.05;

    const baseScore =
      cgpaScore +
      codingScore +
      assignmentScore +
      hackathonScore +
      profileScore +
      attendanceScore +
      externalScore +
      certScore +
      streakScore;
    const totalScore = round2(baseScore * participationBoost);

    return {
      sectionId,
      studentId: student.id,
      cgpaScore: round2(cgpaScore),
      codingScore: round2(codingScore),
      assignmentScore: round2(assignmentScore),
      hackathonScore: round2(hackathonScore),
      profileScore: round2(profileScore),
      externalScore: round2(externalScore + attendanceScore), // externalScore stores combined external + attendance
      streakScore,
      totalScore,
      previousRank: previousRanks.get(student.id) ?? null,
      student: {
        id: student.id,
        name: student.name,
        avatar: student.avatar,
        role: student.role,
        studentProfile: studentProfile,
        leaderboard: coding,
      },
    };
  });

  nextEntries.sort((a, b) => b.totalScore - a.totalScore || a.student.name.localeCompare(b.student.name));

  await prisma.$transaction(
    nextEntries.map((entry, index) =>
      prisma.sectionLeaderboard.upsert({
        where: { sectionId_studentId: { sectionId, studentId: entry.studentId } },
        update: {
          cgpaScore: entry.cgpaScore,
          codingScore: entry.codingScore,
          assignmentScore: entry.assignmentScore,
          hackathonScore: entry.hackathonScore,
          profileScore: entry.profileScore,
          externalScore: entry.externalScore,
          totalScore: entry.totalScore,
          rank: index + 1,
          lastComputedAt: new Date(),
        },
        create: {
          sectionId,
          studentId: entry.studentId,
          cgpaScore: entry.cgpaScore,
          codingScore: entry.codingScore,
          assignmentScore: entry.assignmentScore,
          hackathonScore: entry.hackathonScore,
          profileScore: entry.profileScore,
          externalScore: entry.externalScore,
          totalScore: entry.totalScore,
          rank: index + 1,
        },
      })
    )
  );

  emitLeaderboardUpdated(sectionId);

  return nextEntries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export async function getSectionLeaderboard(
  sectionId: string,
  filter: "overall" | "coding" | "academic" | "profile" | "external",
  search?: string,
  page = 1,
  limit = 20,
  viewer?: JWTPayload
) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { department: true },
  });
  if (!section) throw new AppError("Section not found", 404);

  let entries = await prisma.sectionLeaderboard.findMany({
    where: {
      sectionId,
      ...(search ? { student: { name: { contains: search, mode: "insensitive" } } } : {}),
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          role: true,
          githubUsername: true,
          profile: { select: { phoneNumber: true } },
          studentProfile: {
            include: {
              skills: true,
              projects: true,
              achievements: true,
            },
          },
          leaderboard: true,
        },
      },
    },
  });

  if (entries.length === 0) {
    await recomputeSectionLeaderboard(sectionId);
    entries = await prisma.sectionLeaderboard.findMany({
      where: { sectionId },
      include: {
        student: {
          select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          role: true,
          githubUsername: true,
          profile: { select: { phoneNumber: true } },
          studentProfile: {
            include: {
              skills: true,
                projects: true,
                achievements: true,
              },
            },
            leaderboard: true,
          },
        },
      },
    });
  }

  const ranked = assignRanks(
    entries.map((entry) => ({
      ...entry,
      previousRank: null,
      problemsSolved: entry.student.leaderboard?.problemsSolved ?? 0,
      contestWins: 0,
    })),
    filter
  );

  const start = (page - 1) * limit;
  const end = start + limit;

  const response = {
    section,
    scope: "section" as const,
    scopeId: sectionId,
    filter,
    items: ranked.slice(start, end),
    pagination: {
      page,
      limit,
      total: ranked.length,
      totalPages: Math.ceil(ranked.length / limit),
    },
    lastUpdatedAt: ranked[0]?.updatedAt ?? null,
  };

  if (viewer?.role === Role.STUDENT) {
    return {
      ...response,
      ...buildRestrictedLeaderboard(ranked, viewer.id, response.pagination),
    };
  }

  return {
    ...response,
    self: null,
    viewerMode: "full" as const,
  };
}

export async function getDepartmentLeaderboard(
  departmentId: string,
  filter: "overall" | "coding" | "academic" | "profile" | "external",
  search?: string,
  page = 1,
  limit = 20,
  viewer?: JWTPayload
) {
  const entries = await prisma.sectionLeaderboard.findMany({
    where: {
      section: { departmentId },
      ...(search ? { student: { name: { contains: search, mode: "insensitive" } } } : {}),
    },
    include: {
      section: { select: { id: true, name: true, code: true } },
      student: {
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          role: true,
          githubUsername: true,
          profile: { select: { phoneNumber: true } },
          studentProfile: {
            select: {
              cgpa: true,
              leetcodeSolved: true,
              githubContributions: true,
              currentStreak: true,
              longestStreak: true,
              lastActiveDate: true,
            },
          },
          leaderboard: true,
        },
      },
    },
  });

  const deduped = Array.from(
    new Map(entries.map((entry) => [entry.studentId, entry])).values()
  );
  const ranked = assignRanks(deduped, filter);
  const start = (page - 1) * limit;
  const end = start + limit;

  const response = {
    filter,
    scope: "department" as const,
    scopeId: departmentId,
    items: ranked.slice(start, end),
    pagination: {
      page,
      limit,
      total: ranked.length,
      totalPages: Math.ceil(ranked.length / limit),
    },
    lastUpdatedAt: ranked[0]?.updatedAt ?? null,
  };

  if (viewer?.role === Role.STUDENT) {
    return {
      ...response,
      ...buildRestrictedLeaderboard(ranked, viewer.id, response.pagination),
    };
  }

  return {
    ...response,
    self: null,
    viewerMode: "full" as const,
  };
}

export async function getPlatformLeaderboard(page = 1, limit = 50, viewer?: JWTPayload) {
  const entries = await prisma.sectionLeaderboard.findMany({
    include: {
      section: { select: { id: true, name: true, code: true } },
      student: {
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          role: true,
          email: true,
          githubUsername: true,
          profile: { select: { phoneNumber: true } },
          studentProfile: {
            select: {
              currentStreak: true,
              longestStreak: true,
              lastActiveDate: true,
            },
          },
          leaderboard: true,
        },
      },
    },
  });

  const deduped = Array.from(new Map(entries.map((entry) => [entry.studentId, entry])).values());
  const ranked = assignRanks(deduped, "overall");
  const start = (page - 1) * limit;
  const end = start + limit;

  const response = {
    scope: "global" as const,
    scopeId: null,
    filter: "overall" as const,
    items: ranked.slice(start, end),
    pagination: {
      page,
      limit,
      total: ranked.length,
      totalPages: Math.ceil(ranked.length / limit),
    },
    lastUpdatedAt: ranked[0]?.updatedAt ?? null,
  };

  if (viewer?.role === Role.STUDENT) {
    return {
      ...response,
      ...buildRestrictedLeaderboard(ranked, viewer.id, response.pagination),
    };
  }

  return {
    ...response,
    self: null,
    viewerMode: "full" as const,
  };
}

export async function getStudentLeaderboardSummary(userId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: userId },
    include: {
      section: {
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  if (!enrollment?.sectionId) {
    return {
      section: null,
      department: null,
      global: null,
      sectionRank: null,
      departmentRank: null,
      points: 0,
      solved: 0,
      streak: 0,
      avatar: null,
      student: null,
    };
  }

  let scopedEntry = await prisma.sectionLeaderboard.findUnique({
    where: {
      sectionId_studentId: {
        sectionId: enrollment.sectionId,
        studentId: userId,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
          role: true,
          githubUsername: true,
          profile: { select: { phoneNumber: true } },
          studentProfile: {
            select: {
              currentStreak: true,
              longestStreak: true,
              lastActiveDate: true,
            },
          },
          leaderboard: true,
        },
      },
      section: {
        select: {
          id: true,
          name: true,
          code: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
  });

  if (!scopedEntry) {
    await recomputeSectionLeaderboard(enrollment.sectionId);
    scopedEntry = await prisma.sectionLeaderboard.findUnique({
      where: {
        sectionId_studentId: {
          sectionId: enrollment.sectionId,
          studentId: userId,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            createdAt: true,
            role: true,
            githubUsername: true,
            profile: { select: { phoneNumber: true } },
            studentProfile: {
              select: {
                currentStreak: true,
                longestStreak: true,
                lastActiveDate: true,
              },
            },
            leaderboard: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
            code: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });
  }

  if (!scopedEntry) {
    return {
      section: enrollment.section,
      department: enrollment.section.department,
      global: null,
      sectionRank: null,
      departmentRank: null,
      points: 0,
      solved: 0,
      streak: 0,
      avatar: null,
      student: null,
    };
  }

  const [globalLeaderboard, departmentLeaderboard] = await Promise.all([
    getPlatformLeaderboard(1, 5000),
    getDepartmentLeaderboard(enrollment.section.department.id, "overall", undefined, 1, 5000),
  ]);

  const globalSelf = globalLeaderboard.items.find((entry) => entry.studentId === userId) ?? null;
  const departmentSelf = departmentLeaderboard.items.find((entry) => entry.studentId === userId) ?? null;

  return {
    section: scopedEntry.section,
    department: scopedEntry.section.department,
    global: globalSelf,
    sectionRank: scopedEntry.rank,
    departmentRank: departmentSelf?.rank ?? null,
    points: scopedEntry.totalScore,
    solved: scopedEntry.student.leaderboard?.problemsSolved ?? 0,
    streak: scopedEntry.student.studentProfile?.currentStreak ?? 0,
    avatar: scopedEntry.student.avatar,
    student: mapScopedLeaderboardEntry(scopedEntry, scopedEntry.rank ?? 0),
  };
}

export async function getLeaderboardInsights(sectionId: string) {
  // Grab top 20 students from overall leaderboard
  const data = await getSectionLeaderboard(sectionId, "overall", undefined, 1, 30);
  
  if (data.items.length === 0) {
    return {
      success: true,
      insights: "Not enough data to generate predictive insights.",
    };
  }

  const topPerformers = data.items.slice(0, 3).map((item) => ({
    name: item.student.name,
    score: item.totalScore,
    coding: item.codingScore,
    cgpa: item.cgpaScore,
    hackathon: item.hackathonScore,
  }));

  const trendingStudents = data.items
    .filter((item) => ((item as { previousRank?: number | null }).previousRank !== null && (item.rank ?? 999) < ((item as { previousRank?: number | null }).previousRank ?? 999)) || item.hackathonScore > 30)
    .slice(0, 3)
    .map((item) => ({
      name: item.student.name,
      rankImprovement: (item as { previousRank?: number | null }).previousRank ? ((item as { previousRank?: number | null }).previousRank ?? 0) - (item.rank ?? 0) : "Rising",
      codingScore: item.codingScore,
    }));

  const atRisk = data.items
    .filter((item) => item.totalScore < 30 || item.cgpaScore < 10)
    .slice(0, 3)
    .map((item) => ({
      name: item.student.name,
      score: item.totalScore,
      cgpa: item.cgpaScore,
    }));

  const promptPayload = {
    sectionName: data.section.name,
    averageScore: data.items.reduce((acc, curr) => acc + curr.totalScore, 0) / data.items.length,
    topPerformers,
    trendingStudents,
    atRiskStudents: atRisk,
  };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AppError("AI service not configured for predictive insights", 503);
  }

  const systemPrompt = `You are an expert academic and competitive programming data analyst.
Analyze the provided JSON leaderboard data for a class section and generate predictive insights.

Format your response as valid JSON strictly matching this schema:
{
  "summary": "A 2-sentence executive overview of the class performance.",
  "topPerformers": "Analysis of what the top performers are doing right (e.g., excelling in coding vs academics).",
  "risingStars": "Mention specific students showing momentum or high hackathon engagement and predict their trajectory.",
  "areasOfConcern": "Identify patterns among at-risk students and suggest actionable interventions.",
  "actionableAdvice": [
    "Advice point 1",
    "Advice point 2"
  ]
}`;

  const userPrompt = `Analyze this leaderboard snapshot:\n` + JSON.stringify(promptPayload, null, 2);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://rankroom.app",
      "X-Title": "RankRoom AI Leaderboard Analytics",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "stepfun/step-3.5-flash:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter leaderboard error:", errorText);
    throw new AppError("Failed to fetch AI insights", 502);
  }

  const result = await response.json();
  const rawText = result.choices?.[0]?.message?.content ?? "{}";
  
  let insightsParsed;
  try {
    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    insightsParsed = JSON.parse(cleanedText);
  } catch (err) {
    throw new AppError("Failed to parse AI insights JSON", 500);
  }

  return {
    success: true,
    data: insightsParsed,
  };
}
