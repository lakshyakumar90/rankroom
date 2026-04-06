import { prisma } from "@repo/database";
import { Role, type AuthAssignmentScope, type AuthScope, type JWTPayload } from "@repo/types";
import { Prisma } from "@repo/database";

type ScopedUser = Pick<JWTPayload, "id" | "role" | "scope">;

function isMissingColumnError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022";
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

function isSchemaMismatchError(error: unknown): boolean {
  return isMissingColumnError(error) || isMissingTableError(error);
}

async function getTeacherAssignments(userId: string): Promise<AuthAssignmentScope[]> {
  let assignments: AuthAssignmentScope[] = [];
  try {
    assignments = await prisma.teacherSubjectAssignment.findMany({
      where: { teacherId: userId },
      select: { teacherId: true, subjectId: true, sectionId: true },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    console.error("Teacher assignment query failed due to schema mismatch. Falling back to legacy subject assignments.", {
      userId,
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
    });
  }

  if (assignments.length > 0) {
    return assignments;
  }

  const legacyAssignments = await prisma.subject.findMany({
    where: { teacherId: userId },
    select: { id: true, sectionId: true },
  });

  return legacyAssignments.map((assignment) => ({
    teacherId: userId,
    subjectId: assignment.id,
    sectionId: assignment.sectionId,
  }));
}

export async function buildUserScope(userId: string, role: Role): Promise<AuthScope> {
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN) {
    return {
      departmentIds: [],
      sectionIds: [],
      teachingAssignments: [],
      primaryDepartmentId: null,
      primarySectionId: null,
    };
  }

  if (role === Role.DEPARTMENT_HEAD) {
    const departments = await prisma.department.findMany({
      where: { headId: userId },
      select: { id: true, sections: { select: { id: true } } },
    });

    const departmentIds = departments.map((department) => department.id);
    const sectionIds = departments.flatMap((department) => department.sections.map((section) => section.id));

    return {
      departmentIds,
      sectionIds,
      teachingAssignments: [],
      primaryDepartmentId: departmentIds[0] ?? null,
      primarySectionId: sectionIds[0] ?? null,
    };
  }

  if (role === Role.CLASS_COORDINATOR) {
    // Load from both legacy coordinatorId and new M:N assignment table
    const [legacySections, assignmentRows] = await Promise.all([
      prisma.section.findMany({
        where: { coordinatorId: userId },
        select: { id: true, departmentId: true },
      }),
      prisma.sectionCoordinatorAssignment.findMany({
        where: { userId, isActive: true },
        select: { section: { select: { id: true, departmentId: true } } },
      }),
    ]);

    const allSections = new Map<string, { id: string; departmentId: string }>();
    for (const s of legacySections) allSections.set(s.id, s);
    for (const a of assignmentRows) allSections.set(a.section.id, a.section);

    const sections = Array.from(allSections.values());
    const sectionIds = sections.map((section) => section.id);
    const departmentIds = [...new Set(sections.map((section) => section.departmentId))];

    return {
      departmentIds,
      sectionIds,
      teachingAssignments: [],
      primaryDepartmentId: departmentIds[0] ?? null,
      primarySectionId: sectionIds[0] ?? null,
    };
  }

  if (role === Role.TEACHER) {
    const assignments = await getTeacherAssignments(userId);
    const sectionIds = [...new Set(assignments.map((assignment) => assignment.sectionId))];

    const sections = sectionIds.length
      ? await prisma.section.findMany({
          where: { id: { in: sectionIds } },
          select: { id: true, departmentId: true },
        })
      : [];

    const departmentIds = [...new Set(sections.map((section) => section.departmentId))];

    return {
      departmentIds,
      sectionIds,
      teachingAssignments: assignments,
      primaryDepartmentId: departmentIds[0] ?? null,
      primarySectionId: sectionIds[0] ?? null,
    };
  }

  let enrollments: Array<{ sectionId: string; section: { departmentId: string } }> = [];
  try {
    enrollments = await prisma.enrollment.findMany({
      where: { studentId: userId },
      select: {
        sectionId: true,
        section: { select: { departmentId: true } },
      },
    });
  } catch (error) {
    if (isSchemaMismatchError(error)) {
      console.error("Enrollment scope query failed due to schema mismatch. Returning empty student scope.", {
        userId,
        code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      });
      return {
        departmentIds: [],
        sectionIds: [],
        teachingAssignments: [],
        primaryDepartmentId: null,
        primarySectionId: null,
      };
    }
    throw error;
  }

  const sectionIds = enrollments.map((enrollment) => enrollment.sectionId);
  const departmentIds = [...new Set(enrollments.map((enrollment) => enrollment.section.departmentId))];

  return {
    departmentIds,
    sectionIds,
    teachingAssignments: [],
    primaryDepartmentId: departmentIds[0] ?? null,
    primarySectionId: sectionIds[0] ?? null,
  };
}

export function isGlobalRole(role: Role) {
  return role === Role.SUPER_ADMIN || role === Role.ADMIN;
}

export function userHasTeacherAssignment(user: ScopedUser, sectionId?: string | null, subjectId?: string | null) {
  if (user.role !== Role.TEACHER) {
    return false;
  }

  if (!sectionId) {
    return false;
  }

  if (!subjectId) {
    return user.scope.sectionIds.includes(sectionId);
  }

  return user.scope.teachingAssignments.some(
    (assignment) => assignment.sectionId === sectionId && assignment.subjectId === subjectId
  );
}

export function canUserAccessDepartment(user: ScopedUser, departmentId?: string | null) {
  if (!departmentId) return user.id.length > 0;
  if (isGlobalRole(user.role)) return true;
  return user.scope.departmentIds.includes(departmentId);
}

export function canUserAccessSection(user: ScopedUser, sectionId?: string | null, subjectId?: string | null) {
  if (!sectionId) return user.id.length > 0;
  if (isGlobalRole(user.role)) return true;

  if (user.role === Role.TEACHER) {
    return userHasTeacherAssignment(user, sectionId, subjectId);
  }

  return user.scope.sectionIds.includes(sectionId);
}

export async function getSectionContext(sectionId: string) {
  return prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, departmentId: true, coordinatorId: true },
  });
}

export async function getDepartmentContext(departmentId: string) {
  return prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, headId: true },
  });
}

export async function getSubjectContext(subjectId: string) {
  return prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, sectionId: true, departmentId: true, teacherId: true },
  });
}

export async function getStudentContext(studentId: string) {
  let enrollment:
    | {
        sectionId: string;
        section: { departmentId: string };
      }
    | null = null;

  try {
    enrollment = await prisma.enrollment.findFirst({
      where: { studentId },
      select: {
        sectionId: true,
        section: { select: { departmentId: true } },
      },
      orderBy: { enrolledAt: "asc" },
    });
  } catch (error) {
    if (isSchemaMismatchError(error)) {
      console.error("Student context query failed due to schema mismatch. Returning empty student context.", {
        studentId,
        code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      });
      return {
        ownerId: studentId,
        sectionId: null,
        departmentId: null,
      };
    }
    throw error;
  }

  return {
    ownerId: studentId,
    sectionId: enrollment?.sectionId ?? null,
    departmentId: enrollment?.section.departmentId ?? null,
  };
}
