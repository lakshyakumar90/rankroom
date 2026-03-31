import { prisma, Prisma } from "@repo/database";
import { Role, type JWTPayload, type Notification, type NotificationSendRequest } from "@repo/types";
import { AppError } from "../middleware/error";
import {
  emitNotificationToDepartment,
  emitNotificationToSection,
  emitNotificationToUser,
} from "../lib/socket";

function toNotificationDto(notification: Awaited<ReturnType<typeof prisma.notification.create>>): Notification {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type as Notification["type"],
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    link: notification.link,
    entityId: notification.entityId,
    entityType: notification.entityType,
    targetRole: notification.targetRole as Notification["targetRole"],
    targetSectionId: notification.targetSectionId,
    targetDepartmentId: notification.targetDepartmentId,
    createdAt: notification.createdAt.toISOString(),
  };
}

function dedupeIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => !!value))];
}

function isSchemaMismatchError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

async function getUsersForSection(sectionId: string, role?: Role) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      departmentId: true,
      coordinatorId: true,
      department: { select: { headId: true } },
      enrollments: { select: { studentId: true } },
      teacherAssignments: {
        distinct: ["teacherId"],
        select: { teacherId: true },
      },
    },
  });

  if (!section) {
    throw new AppError("Section not found", 404);
  }

  if (role === Role.STUDENT) return dedupeIds(section.enrollments.map((entry) => entry.studentId));
  if (role === Role.CLASS_COORDINATOR) return dedupeIds([section.coordinatorId]);
  if (role === Role.TEACHER) return dedupeIds(section.teacherAssignments.map((entry) => entry.teacherId));
  if (role === Role.DEPARTMENT_HEAD) return dedupeIds([section.department.headId]);

  return dedupeIds([
    section.coordinatorId,
    section.department.headId,
    ...section.enrollments.map((entry) => entry.studentId),
    ...section.teacherAssignments.map((entry) => entry.teacherId),
  ]);
}

async function getUsersForDepartment(departmentId: string, role?: Role) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      headId: true,
      sections: {
        select: {
          id: true,
          coordinatorId: true,
          enrollments: { select: { studentId: true } },
          teacherAssignments: {
            distinct: ["teacherId"],
            select: { teacherId: true },
          },
        },
      },
    },
  });

  if (!department) throw new AppError("Department not found", 404);

  const studentIds = department.sections.flatMap((section) => section.enrollments.map((entry) => entry.studentId));
  const coordinatorIds = department.sections.map((section) => section.coordinatorId);
  const teacherIds = department.sections.flatMap((section) => section.teacherAssignments.map((entry) => entry.teacherId));

  if (role === Role.STUDENT) return dedupeIds(studentIds);
  if (role === Role.CLASS_COORDINATOR) return dedupeIds(coordinatorIds);
  if (role === Role.TEACHER) return dedupeIds(teacherIds);
  if (role === Role.DEPARTMENT_HEAD) return dedupeIds([department.headId]);

  return dedupeIds([department.headId, ...studentIds, ...coordinatorIds, ...teacherIds]);
}

async function getGlobalUsers(role?: Role) {
  const users = await prisma.user.findMany({
    where: role ? { role } : {},
    select: { id: true },
  });

  return users.map((user) => user.id);
}

export async function resolveNotificationRecipients(input: NotificationSendRequest) {
  if (input.targetSectionId) {
    return getUsersForSection(input.targetSectionId, input.targetRole);
  }

  if (input.targetDepartmentId) {
    return getUsersForDepartment(input.targetDepartmentId, input.targetRole);
  }

  return getGlobalUsers(input.targetRole);
}

export function validateNotificationAuthority(actor: JWTPayload, input: NotificationSendRequest) {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) return;

  if (actor.role === Role.DEPARTMENT_HEAD) {
    if (!input.targetDepartmentId || !actor.scope.departmentIds.includes(input.targetDepartmentId)) {
      throw new AppError("Department-scoped notifications require your department", 403);
    }
    return;
  }

  if (actor.role === Role.CLASS_COORDINATOR) {
    if (!input.targetSectionId || !actor.scope.sectionIds.includes(input.targetSectionId)) {
      throw new AppError("Section-scoped notifications require your section", 403);
    }
    return;
  }

  throw new AppError("Insufficient permissions", 403);
}

export async function sendNotifications(actor: JWTPayload, input: NotificationSendRequest) {
  validateNotificationAuthority(actor, input);
  const recipientIds = await resolveNotificationRecipients(input);
  if (recipientIds.length === 0) {
    return [];
  }

  const notifications = await prisma.$transaction(
    recipientIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link ?? null,
          entityId: input.entityId ?? null,
          entityType: input.entityType ?? null,
          targetRole: input.targetRole ?? null,
          targetSectionId: input.targetSectionId ?? null,
          targetDepartmentId: input.targetDepartmentId ?? null,
        },
      })
    )
  );

  notifications.forEach((notification) => {
    emitNotificationToUser(notification.userId, toNotificationDto(notification));
  });

  if (input.targetSectionId && !input.targetRole) {
    emitNotificationToSection(input.targetSectionId, toNotificationDto(notifications[0]!));
  }

  if (input.targetDepartmentId && !input.targetRole) {
    emitNotificationToDepartment(input.targetDepartmentId, toNotificationDto(notifications[0]!));
  }

  return notifications;
}

export async function listOwnNotifications(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  let notifications: Awaited<ReturnType<typeof prisma.notification.findMany>> = [];
  let total = 0;
  let unreadCount = 0;

  try {
    [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
  } catch (error) {
    if (!isSchemaMismatchError(error)) {
      throw error;
    }

    notifications = [];
    total = 0;
    unreadCount = 0;
  }

  return {
    items: notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
  return { success: true };
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { success: true };
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}
