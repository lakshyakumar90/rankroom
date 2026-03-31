import cron from "node-cron";
import { prisma } from "@repo/database";
import type { Notification } from "@repo/types";
import { emitNotificationToUser } from "../lib/socket";
import { logger } from "../lib/logger";
import { getLowAttendance } from "../services/attendance.service";

type NotificationRecord = Awaited<ReturnType<typeof prisma.notification.create>>;

function toNotificationDto(notification: NotificationRecord): Notification {
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

async function notifyRecipient(data: {
  userId: string;
  title: string;
  message: string;
  entityId: string;
  sectionId: string;
  departmentId: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: "ATTENDANCE_LOW",
      title: data.title,
      message: data.message,
      link: `/attendance/reports?sectionId=${data.sectionId}`,
      entityId: data.entityId,
      entityType: "ATTENDANCE",
      targetSectionId: data.sectionId,
      targetDepartmentId: data.departmentId,
    },
  });

  emitNotificationToUser(data.userId, toNotificationDto(notification));
}

export async function runAttendanceAlertJob() {
  const sections = await prisma.section.findMany({
    include: {
      department: { select: { id: true, headId: true } },
    },
  });

  let alertCount = 0;

  for (const section of sections) {
    const lowAttendanceRows = await getLowAttendance(section.id);

    for (const row of lowAttendanceRows) {
      const percentage = Number(row.percentage ?? 0).toFixed(1);
      const title = `Low attendance in ${row.subject.name}`;
      const baseMessage = `${row.studentName} is at ${percentage}% attendance in ${row.subject.name}.`;

      await notifyRecipient({
        userId: row.studentId,
        title,
        message: `Your attendance is ${percentage}% in ${row.subject.name}. Please improve it.`,
        entityId: row.subject.id,
        sectionId: section.id,
        departmentId: section.departmentId,
      });
      alertCount += 1;

      if (section.coordinatorId) {
        await notifyRecipient({
          userId: section.coordinatorId,
          title,
          message: baseMessage,
          entityId: row.subject.id,
          sectionId: section.id,
          departmentId: section.departmentId,
        });
        alertCount += 1;
      }

      if (section.department.headId) {
        await notifyRecipient({
          userId: section.department.headId,
          title,
          message: baseMessage,
          entityId: row.subject.id,
          sectionId: section.id,
          departmentId: section.departmentId,
        });
        alertCount += 1;
      }
    }
  }

  logger.info({ alertCount }, "Completed low attendance alert job");
  return { alertCount };
}

export function startAttendanceAlertJob() {
  cron.schedule(
    "0 1 * * *",
    () => {
      void runAttendanceAlertJob().catch((error) => {
        logger.error({ error }, "Attendance alert job failed");
      });
    },
    { timezone: process.env["TZ"] ?? "Asia/Kolkata" }
  );
}
