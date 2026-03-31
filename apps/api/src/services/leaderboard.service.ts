import { prisma } from "@repo/database";
import { emitLeaderboardUpdated } from "../lib/socket";
import { AppError } from "../middleware/error";

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

  const [contestWins, gradeAverages, submissions, hackathonStats] = await Promise.all([
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

    const cgpaRaw =
      studentProfile?.cgpa ??
      ((gradeStats?.avgMaxMarks ?? 0) > 0 ? ((gradeStats?.avgMarks ?? 0) / (gradeStats?.avgMaxMarks ?? 100)) * 10 : 0);
    const cgpaScore = clamp((cgpaRaw / 10) * 100) * 0.25;

    const codingBase =
      (totalProblems > 0 ? ((coding?.problemsSolved ?? 0) / totalProblems) * 50 : 0) +
      (coding?.contestsParticipated ?? 0) * 5 +
      (contestWinMap.get(student.id) ?? 0) * 20;
    const codingScore = clamp(codingBase) * 0.2;

    const avgGradePct =
      gradeStats && (gradeStats.avgMaxMarks ?? 0) > 0 ? (gradeStats.avgMarks / gradeStats.avgMaxMarks) * 100 : 0;
    const assignmentBase =
      (totalAssignments > 0 ? ((assignmentStats?.submitted ?? 0) / totalAssignments) * 50 : 0) +
      (avgGradePct / 100) * 50;
    const assignmentScore = clamp(assignmentBase) * 0.2;

    const hackathonBase =
      hackathonStatsForStudent.registrations * 5 +
      hackathonStatsForStudent.wins * 30 +
      hackathonStatsForStudent.top3 * 15;
    const hackathonScore = clamp(hackathonBase) * 0.1;

    const profileBase =
      (studentProfile?.skills.length ?? 0) * 3 +
      (studentProfile?.projects.length ?? 0) * 10 +
      (studentProfile?.achievements.length ?? 0) * 5 +
      (studentProfile?.resumeUrl ? 10 : 0);
    const profileScore = clamp(profileBase) * 0.1;

    const externalRaw =
      (studentProfile?.leetcodeSolved ?? 0) * 0.5 +
      ((studentProfile?.codechefRating ?? 0) / 100) +
      ((studentProfile?.codeforcesRating ?? 0) / 100) +
      (studentProfile?.githubContributions ?? 0) * 0.1;
    const externalBase = maxExternal > 0 ? (externalRaw / maxExternal) * 100 : 0;
    const externalScore = clamp(externalBase) * 0.15;

    const totalScore = round2(cgpaScore + codingScore + assignmentScore + hackathonScore + profileScore + externalScore);

    return {
      sectionId,
      studentId: student.id,
      cgpaScore: round2(cgpaScore),
      codingScore: round2(codingScore),
      assignmentScore: round2(assignmentScore),
      hackathonScore: round2(hackathonScore),
      profileScore: round2(profileScore),
      externalScore: round2(externalScore),
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
  limit = 20
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
          role: true,
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
            role: true,
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

  const sorted = entries
    .map((entry) => ({
      ...entry,
      previousRank: null,
      problemsSolved: entry.student.leaderboard?.problemsSolved ?? 0,
      contestWins: 0,
    }))
    .sort((a, b) => getSortMetric(b, filter) - getSortMetric(a, filter) || a.student.name.localeCompare(b.student.name));

  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    section,
    filter,
    items: sorted.slice(start, end),
    pagination: {
      page,
      limit,
      total: sorted.length,
      totalPages: Math.ceil(sorted.length / limit),
    },
    lastUpdatedAt: sorted[0]?.updatedAt ?? null,
  };
}

export async function getDepartmentLeaderboard(
  departmentId: string,
  filter: "overall" | "coding" | "academic" | "profile" | "external",
  search?: string,
  page = 1,
  limit = 20
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
          role: true,
          studentProfile: {
            select: {
              cgpa: true,
              leetcodeSolved: true,
              githubContributions: true,
            },
          },
          leaderboard: true,
        },
      },
    },
  });

  const sorted = entries.sort((a, b) => getSortMetric(b, filter) - getSortMetric(a, filter));
  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    filter,
    items: sorted.slice(start, end),
    pagination: {
      page,
      limit,
      total: sorted.length,
      totalPages: Math.ceil(sorted.length / limit),
    },
  };
}

export async function getPlatformLeaderboard(page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [entries, total] = await Promise.all([
    prisma.leaderboard.findMany({
      include: {
        user: {
          select: { id: true, name: true, avatar: true, githubUsername: true, role: true, email: true, createdAt: true },
        },
      },
      orderBy: { totalPoints: "desc" },
      skip,
      take: limit,
    }),
    prisma.leaderboard.count(),
  ]);

  return {
    items: entries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
