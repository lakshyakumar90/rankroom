import { prisma } from "@repo/database";
import { AppError } from "../middleware/error";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
} as const;

async function buildDepartmentStats(departmentId: string) {
  const [sectionsCount, studentsCount, teacherRows, activeContests] = await Promise.all([
    prisma.section.count({ where: { departmentId } }),
    prisma.enrollment.count({ where: { section: { departmentId } } }),
    prisma.teacherSubjectAssignment.findMany({
      where: { section: { departmentId } },
      distinct: ["teacherId"],
      select: { teacherId: true },
    }),
    prisma.contest.count({
      where: {
        section: { departmentId },
        status: { in: ["UPCOMING", "LIVE"] },
      },
    }),
  ]);

  return {
    sectionsCount,
    studentsCount,
    teachersCount: teacherRows.length,
    activeContests,
  };
}

export async function listDepartments() {
  const departments = await prisma.department.findMany({
    include: {
      head: { select: userSelect },
    },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    departments.map(async (department) => ({
      ...department,
      stats: await buildDepartmentStats(department.id),
    }))
  );
}

export async function createDepartment(data: {
  name: string;
  code: string;
  description?: string;
  headId?: string | null;
}) {
  return prisma.department.create({
    data: {
      name: data.name,
      code: data.code,
      description: data.description,
      headId: data.headId ?? null,
    },
    include: { head: { select: userSelect } },
  });
}

export async function updateDepartment(
  id: string,
  data: Partial<{ name: string; code: string; description?: string; headId?: string | null }>
) {
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw new AppError("Department not found", 404);

  return prisma.department.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.headId !== undefined ? { headId: data.headId } : {}),
    },
    include: { head: { select: userSelect } },
  });
}

export async function deleteDepartment(id: string) {
  const sectionsCount = await prisma.section.count({ where: { departmentId: id } });
  if (sectionsCount > 0) {
    throw new AppError("Delete sections in this department first", 400);
  }

  await prisma.department.delete({ where: { id } });
  return { success: true };
}

export async function getDepartmentSections(id: string) {
  return prisma.section.findMany({
    where: { departmentId: id },
    include: {
      coordinator: { select: userSelect },
      _count: {
        select: {
          enrollments: true,
          teacherAssignments: true,
        },
      },
    },
    orderBy: [{ semester: "asc" }, { name: "asc" }],
  });
}

export async function getDepartmentMembers(id: string) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      head: { select: userSelect },
      sections: {
        select: {
          coordinator: { select: userSelect },
          teacherAssignments: {
            distinct: ["teacherId"],
            select: {
              teacher: { select: userSelect },
            },
          },
        },
      },
    },
  });

  if (!department) throw new AppError("Department not found", 404);

  const members = new Map<string, (typeof department.head)>();
  if (department.head) members.set(department.head.id, department.head);

  for (const section of department.sections) {
    if (section.coordinator) members.set(section.coordinator.id, section.coordinator);
    for (const assignment of section.teacherAssignments) {
      members.set(assignment.teacher.id, assignment.teacher);
    }
  }

  return Array.from(members.values());
}

export async function getDepartmentAnalytics(id: string) {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const [stats, sectionsAttendance, topLeaderboard] = await Promise.all([
    buildDepartmentStats(id),
    prisma.section.findMany({
      where: { departmentId: id },
      select: {
        id: true,
        name: true,
        attendanceSessions: {
          where: { date: { gte: startOfDay, lte: endOfDay } },
          select: {
            records: { select: { status: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.sectionLeaderboard.findMany({
      where: { section: { departmentId: id } },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            studentProfile: {
              select: { cgpa: true, leetcodeSolved: true, githubContributions: true },
            },
          },
        },
      },
      orderBy: [{ totalScore: "desc" }, { updatedAt: "desc" }],
      take: 10,
    }),
  ]);

  const attendanceSummary = sectionsAttendance.map((section) => {
    const totals = section.attendanceSessions.flatMap((session) => session.records);
    const presentLike = totals.filter((record) => record.status !== "ABSENT").length;
    const percentage = totals.length === 0 ? 0 : Math.round((presentLike / totals.length) * 100);
    return {
      sectionId: section.id,
      sectionName: section.name,
      todayAttendancePercentage: percentage,
    };
  });

  return {
    ...stats,
    attendanceSummary,
    topLeaderboard,
  };
}

export async function getDepartmentLeaderboard(id: string, search?: string) {
  return prisma.sectionLeaderboard.findMany({
    where: {
      section: { departmentId: id },
      ...(search
        ? {
            student: {
              name: { contains: search, mode: "insensitive" },
            },
          }
        : {}),
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
            select: { leetcodeSolved: true, githubContributions: true, cgpa: true },
          },
        },
      },
    },
    orderBy: [{ totalScore: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getDepartmentTeachers(id: string) {
  const rows = await prisma.teacherSubjectAssignment.findMany({
    where: { section: { departmentId: id } },
    distinct: ["teacherId"],
    include: {
      teacher: { select: userSelect },
      subject: { select: { id: true, name: true, code: true } },
      section: { select: { id: true, name: true, code: true } },
    },
    orderBy: { teacher: { name: "asc" } },
  });
  // Merge multiple subjects per teacher into one record
  const teacherMap = new Map<string, typeof rows[0] & { subjects: Array<{ id: string; name: string; code: string; sectionId: string; sectionName: string }> }>();
  for (const row of rows) {
    if (!teacherMap.has(row.teacherId)) {
      teacherMap.set(row.teacherId, { ...row, subjects: [] });
    }
    teacherMap.get(row.teacherId)!.subjects.push({
      id: row.subject.id,
      name: row.subject.name,
      code: row.subject.code,
      sectionId: row.section.id,
      sectionName: row.section.name,
    });
  }
  return Array.from(teacherMap.values()).map(({ teacher, subjects }) => ({ ...teacher, subjects }));
}

export async function getDepartmentStudents(id: string, search?: string) {
  return prisma.enrollment.findMany({
    where: {
      section: { departmentId: id },
      ...(search
        ? { student: { name: { contains: search, mode: "insensitive" } } }
        : {}),
    },
    include: {
      student: {
        select: {
          ...userSelect,
          studentProfile: {
            select: { cgpa: true, leetcodeSolved: true, githubContributions: true },
          },
        },
      },
      section: { select: { id: true, name: true, code: true } },
    },
    orderBy: { student: { name: "asc" } },
  });
}

export async function getDepartmentContests(id: string) {
  return prisma.contest.findMany({
    where: { OR: [{ departmentId: id }, { section: { departmentId: id } }] },
    include: {
      createdBy: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      _count: { select: { registrations: true, problems: true } },
    },
    orderBy: { startTime: "desc" },
  });
}

export async function getDepartmentHackathons(id: string) {
  return prisma.hackathon.findMany({
    where: { departmentId: id },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { registrations: true, teams: true } },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getDepartmentDashboard(id: string) {
  const [stats, sections, recentNotifications] = await Promise.all([
    buildDepartmentStats(id),
    prisma.section.findMany({
      where: { departmentId: id },
      include: {
        coordinator: { select: userSelect },
        _count: { select: { enrollments: true, subjects: true } },
      },
      orderBy: [{ semester: "asc" }, { name: "asc" }],
    }),
    prisma.notification.findMany({
      where: {
        OR: [
          { targetDepartmentId: id },
          { targetSection: { departmentId: id } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, title: true, message: true, createdAt: true, link: true },
    }),
  ]);

  return { stats, sections, recentNotifications };
}
