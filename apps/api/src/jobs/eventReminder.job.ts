import cron from "node-cron";
import { prisma } from "@repo/database";
import { Role, type Notification } from "@repo/types";
import { emitNotificationToUser } from "../lib/socket";
import { logger } from "../lib/logger";
import { computeHackathonEligibility } from "../services/hackathon.service";

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

async function createNotificationIfMissing(input: {
  userId: string;
  type: "CONTEST_STARTING_SOON" | "HACKATHON_DEADLINE_APPROACHING";
  title: string;
  message: string;
  entityId: string;
  entityType: "CONTEST" | "HACKATHON";
  link: string;
  targetSectionId?: string | null;
  targetDepartmentId?: string | null;
  lookbackHours: number;
}) {
  const since = new Date(Date.now() - input.lookbackHours * 60 * 60 * 1000);
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      entityId: input.entityId,
      createdAt: { gte: since },
    },
    select: { id: true },
  });

  if (existing) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      entityId: input.entityId,
      entityType: input.entityType,
      targetSectionId: input.targetSectionId ?? null,
      targetDepartmentId: input.targetDepartmentId ?? null,
    },
  });

  emitNotificationToUser(input.userId, toNotificationDto(notification));
  return notification;
}

async function getContestRecipients(sectionId?: string | null) {
  if (!sectionId) {
    const users = await prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      coordinatorId: true,
      enrollments: { select: { studentId: true } },
      teacherAssignments: { distinct: ["teacherId"], select: { teacherId: true } },
    },
  });

  if (!section) {
    return [];
  }

  return [
    ...section.enrollments.map((entry) => entry.studentId),
    ...section.teacherAssignments.map((entry) => entry.teacherId),
    ...(section.coordinatorId ? [section.coordinatorId] : []),
  ];
}

export async function runEventReminderJob() {
  const now = new Date();
  const contestWindowEnd = new Date(now.getTime() + 60 * 60 * 1000);
  const hackathonWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [contests, hackathons] = await Promise.all([
    prisma.contest.findMany({
      where: {
        status: "UPCOMING",
        startTime: {
          gte: now,
          lte: contestWindowEnd,
        },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        sectionId: true,
      },
    }),
    prisma.hackathon.findMany({
      where: {
        status: { in: ["UPCOMING", "REGISTRATION_OPEN"] },
        registrationDeadline: {
          gte: now,
          lte: hackathonWindowEnd,
        },
      },
      select: {
        id: true,
        title: true,
        departmentId: true,
        registrationDeadline: true,
      },
    }),
  ]);

  let reminderCount = 0;

  for (const contest of contests) {
    const recipients = await getContestRecipients(contest.sectionId);
    for (const userId of recipients) {
      const created = await createNotificationIfMissing({
        userId,
        type: "CONTEST_STARTING_SOON",
        title: "Contest starting soon",
        message: `${contest.title} starts at ${contest.startTime.toLocaleString()}.`,
        entityId: contest.id,
        entityType: "CONTEST",
        link: `/contests/${contest.id}`,
        targetSectionId: contest.sectionId ?? null,
        lookbackHours: 2,
      });

      if (created) {
        reminderCount += 1;
      }
    }
  }

  for (const hackathon of hackathons) {
    const students = await prisma.user.findMany({
      where:
        hackathon.departmentId
          ? {
              role: Role.STUDENT,
              enrollments: {
                some: {
                  section: { departmentId: hackathon.departmentId },
                },
              },
            }
          : { role: Role.STUDENT },
      select: { id: true },
    });

    for (const student of students) {
      const eligibility = await computeHackathonEligibility(hackathon.id, student.id).catch(() => ({
        isEligible: false,
      }));

      if (!eligibility.isEligible) {
        continue;
      }

      const created = await createNotificationIfMissing({
        userId: student.id,
        type: "HACKATHON_DEADLINE_APPROACHING",
        title: "Hackathon deadline approaching",
        message: `${hackathon.title} registration closes at ${hackathon.registrationDeadline.toLocaleString()}.`,
        entityId: hackathon.id,
        entityType: "HACKATHON",
        link: `/hackathons/${hackathon.id}`,
        targetDepartmentId: hackathon.departmentId ?? null,
        lookbackHours: 26,
      });

      if (created) {
        reminderCount += 1;
      }
    }
  }

  logger.info({ reminderCount }, "Completed event reminder job");
  return { reminderCount };
}

export function startEventReminderJob() {
  cron.schedule(
    "0 * * * *",
    () => {
      void runEventReminderJob().catch((error) => {
        logger.error({ error }, "Event reminder job failed");
      });
    },
    { timezone: process.env["TZ"] ?? "Asia/Kolkata" }
  );
}
