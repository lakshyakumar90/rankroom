import { prisma } from "@repo/database";
import { Role, type JWTPayload } from "@repo/types";
import { AppError } from "../middleware/error";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
} as const;

function buildSectionWhere(user: JWTPayload) {
  if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) {
    return {};
  }

  if (user.role === Role.DEPARTMENT_HEAD) {
    return { departmentId: { in: user.scope.departmentIds } };
  }

  if (user.role === Role.CLASS_COORDINATOR || user.role === Role.TEACHER || user.role === Role.STUDENT) {
    return { id: { in: user.scope.sectionIds } };
  }

  return { id: "__none__" };
}

export async function listSections(user: JWTPayload) {
  return prisma.section.findMany({
    where: buildSectionWhere(user),
    include: {
      department: true,
      coordinator: { select: userSelect },
      _count: {
        select: {
          enrollments: true,
          teacherAssignments: true,
        },
      },
    },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });
}

export async function createSection(data: {
  name: string;
  code: string;
  semester: number;
  academicYear: string;
  departmentId: string;
  coordinatorId?: string | null;
}) {
  return prisma.section.create({
    data: {
      name: data.name,
      code: data.code,
      semester: data.semester,
      academicYear: data.academicYear,
      departmentId: data.departmentId,
      coordinatorId: data.coordinatorId ?? null,
    },
    include: {
      department: true,
      coordinator: { select: userSelect },
    },
  });
}

export async function updateSection(
  id: string,
  data: Partial<{
    name: string;
    code: string;
    semester: number;
    academicYear: string;
    departmentId: string;
    coordinatorId?: string | null;
  }>
) {
  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) throw new AppError("Section not found", 404);

  return prisma.section.update({
    where: { id },
    data,
    include: {
      department: true,
      coordinator: { select: userSelect },
    },
  });
}

export async function deleteSection(id: string) {
  await prisma.section.delete({ where: { id } });
  return { success: true };
}

export async function getSectionStudents(id: string) {
  return prisma.enrollment.findMany({
    where: { sectionId: id },
    include: {
      student: {
        select: {
          ...userSelect,
          studentProfile: {
            select: {
              cgpa: true,
              leetcodeSolved: true,
              githubContributions: true,
            },
          },
        },
      },
    },
    orderBy: { student: { name: "asc" } },
  });
}

export async function getSectionTeachers(id: string) {
  return prisma.teacherSubjectAssignment.findMany({
    where: { sectionId: id },
    distinct: ["teacherId", "subjectId"],
    include: {
      teacher: { select: userSelect },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ teacher: { name: "asc" } }, { subject: { name: "asc" } }],
  });
}

export async function getSectionAttendanceSummary(id: string, subjectId?: string) {
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      sectionId: id,
      ...(subjectId ? { subjectId } : {}),
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      records: {
        select: { status: true },
      },
    },
    orderBy: { date: "desc" },
  });

  return sessions.map((session) => {
    const total = session.records.length;
    const present = session.records.filter((record) => record.status === "PRESENT").length;
    const late = session.records.filter((record) => record.status === "LATE").length;
    const absent = total - present - late;
    return {
      sessionId: session.id,
      date: session.date,
      subject: session.subject,
      topic: session.topic,
      present,
      late,
      absent,
      total,
      percentage: total === 0 ? 0 : Math.round(((present + late) / total) * 100),
    };
  });
}

export async function getSectionAssignments(id: string) {
  return prisma.assignment.findMany({
    where: { subject: { sectionId: id } },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: userSelect },
      _count: { select: { submissions: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function getSectionLeaderboard(id: string) {
  return prisma.sectionLeaderboard.findMany({
    where: { sectionId: id },
    include: {
      student: {
        select: {
          ...userSelect,
          studentProfile: {
            select: {
              cgpa: true,
              leetcodeSolved: true,
              githubContributions: true,
            },
          },
        },
      },
    },
    orderBy: [{ totalScore: "desc" }, { updatedAt: "desc" }],
  });
}
