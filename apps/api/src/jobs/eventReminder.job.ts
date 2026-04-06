/**
 * Event reminder job — Redis-backed scheduled notifications with idempotency,
 * structured logging, retry tracking, and per-run audit records.
 *
 * Run order per tick:
 * 1. Schedule upcoming reminders into ScheduledNotification rows (deduped by key)
 * 2. Pick PENDING jobs that are due
 * 3. For each job: resolve eligible recipients, create Notification rows, emit via Socket.IO
 * 4. Write a ReminderJobRun audit record
 */

import cron from "node-cron";
import { prisma } from "@repo/database";
import { Role, type Notification } from "@repo/types";
import { emitNotificationToUser } from "../lib/socket";
import { logger } from "../lib/logger";

type NotificationRecord = Awaited<ReturnType<typeof prisma.notification.create>>;

function toNotificationDto(n: NotificationRecord): Notification {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type as Notification["type"],
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    link: n.link,
    entityId: n.entityId,
    entityType: n.entityType,
    targetRole: n.targetRole as Notification["targetRole"],
    targetSectionId: n.targetSectionId,
    targetDepartmentId: n.targetDepartmentId,
    createdAt: n.createdAt.toISOString(),
  };
}

// ─── Schedule upcoming events into the queue ──────────────────────────────────

async function scheduleUpcomingReminders() {
  const now = new Date();
  const h24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const h1 = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const h48 = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [contests, hackathons, assignments] = await Promise.all([
    prisma.contest.findMany({
      where: { status: { in: ["UPCOMING", "REGISTRATION_OPEN", "SCHEDULED"] }, startTime: { gte: now, lte: h48 } },
      select: { id: true, title: true, startTime: true, sectionId: true, departmentId: true },
    }),
    prisma.hackathon.findMany({
      where: { status: { in: ["UPCOMING", "REGISTRATION_OPEN"] }, startDate: { gte: now, lte: d7 } },
      select: { id: true, title: true, registrationDeadline: true, startDate: true, departmentId: true },
    }),
    prisma.assignment.findMany({
      where: { status: { in: ["ACTIVE", "CREATED"] }, dueDate: { gte: now, lte: h48 } },
      include: { audience: { select: { studentId: true } }, subject: { select: { id: true, name: true, sectionId: true } } },
    }),
  ]);

  const toSchedule: Array<{
    jobType: string;
    entityType: string;
    entityId: string;
    scheduledFor: Date;
    recipientScope: object;
    dedupeKey: string;
  }> = [];

  for (const contest of contests) {
    for (const [label, target] of [["24h", h24], ["1h", h1]] as [string, Date][]) {
      if (contest.startTime >= now && contest.startTime <= target) {
        toSchedule.push({
          jobType: "CONTEST_STARTING_SOON",
          entityType: "CONTEST",
          entityId: contest.id,
          scheduledFor: now,
          recipientScope: { sectionId: contest.sectionId, departmentId: contest.departmentId },
          dedupeKey: `CONTEST_STARTING_SOON:${contest.id}:${label}`,
        });
      }
    }
  }

  for (const hackathon of hackathons) {
    const startsIn7Days = hackathon.startDate >= now && hackathon.startDate <= d7;
    const startsIn1Day = hackathon.startDate >= now && hackathon.startDate <= h24;

    if (startsIn7Days) {
      toSchedule.push({
        jobType: "HACKATHON_STARTING_SOON",
        entityType: "HACKATHON",
        entityId: hackathon.id,
        scheduledFor: now,
        recipientScope: { registrationOnly: true },
        dedupeKey: `HACKATHON_STARTING_SOON:${hackathon.id}:7d`,
      });
    }
    if (startsIn1Day) {
      toSchedule.push({
        jobType: "HACKATHON_STARTING_SOON",
        entityType: "HACKATHON",
        entityId: hackathon.id,
        scheduledFor: now,
        recipientScope: { registrationOnly: true },
        dedupeKey: `HACKATHON_STARTING_SOON:${hackathon.id}:1d`,
      });
    }
  }

  for (const assignment of assignments) {
    toSchedule.push({
      jobType: "ASSIGNMENT_DEADLINE_SOON",
      entityType: "ASSIGNMENT",
      entityId: assignment.id,
      scheduledFor: now,
      recipientScope: {
        studentIds: assignment.audience.map((a) => a.studentId),
        sectionId: assignment.subject.sectionId,
      },
      dedupeKey: `ASSIGNMENT_DEADLINE_SOON:${assignment.id}`,
    });
  }

  // Batch upsert — skip on conflict (idempotent)
  for (const job of toSchedule) {
    await prisma.scheduledNotification.upsert({
      where: { dedupeKey: job.dedupeKey },
      update: {},
      create: { ...job, status: "PENDING" },
    }).catch(() => {
      // Unique constraint hit = already scheduled, fine
    });
  }
}

// ─── Resolve recipients for a scheduled job ───────────────────────────────────

async function resolveRecipients(job: { jobType: string; entityType: string; entityId: string; recipientScope: unknown }): Promise<string[]> {
  const scope = job.recipientScope as {
    sectionId?: string | null;
    departmentId?: string | null;
    studentIds?: string[];
    registrationOnly?: boolean;
  };

  if (job.entityType === "ASSIGNMENT" && scope.studentIds?.length) {
    return scope.studentIds;
  }

  if (job.entityType === "HACKATHON") {
    const registrations = await prisma.hackathonRegistration.findMany({
      where: { hackathonId: job.entityId },
      select: {
        studentId: true,
        student: {
          select: {
            settings: {
              select: {
                hackathonReminders: true,
              },
            },
          },
        },
      },
    });
    return registrations
      .filter((entry) => entry.student.settings?.hackathonReminders ?? true)
      .map((entry) => entry.studentId);
  }

  // Contest
  if (scope.sectionId) {
    const section = await prisma.section.findUnique({
      where: { id: scope.sectionId },
      select: {
        enrollments: { select: { studentId: true } },
        teacherAssignments: { distinct: ["teacherId"], select: { teacherId: true } },
        coordinatorId: true,
      },
    });
    if (!section) return [];
    return [
      ...section.enrollments.map((e) => e.studentId),
      ...section.teacherAssignments.map((e) => e.teacherId),
      ...(section.coordinatorId ? [section.coordinatorId] : []),
    ];
  }

  const users = await prisma.user.findMany({ where: { role: Role.STUDENT }, select: { id: true } });
  return users.map((u) => u.id);
}

// ─── Deliver notifications for one scheduled job ─────────────────────────────

async function deliverJob(job: {
  id: string;
  jobType: string;
  entityType: string;
  entityId: string;
  recipientScope: unknown;
}) {
  const startTime = Date.now();
  let deliveredCount = 0;
  let failedCount = 0;
  let error: string | undefined;

  try {
    // Mark as processing
    await prisma.scheduledNotification.update({
      where: { id: job.id },
      data: { status: "PROCESSING" },
    });

    const recipients = await resolveRecipients(job);

    const [title, message, link, type, notifType] = resolveNotificationContent(job);

    for (const userId of recipients) {
      try {
        const dedupeKey = `${job.jobType}:${job.entityId}:${userId}`;

        // Skip if already sent
        const existing = await prisma.notification.findFirst({
          where: { userId, dedupeKey },
          select: { id: true },
        });
        if (existing) continue;

        const notification = await prisma.notification.create({
          data: {
            userId,
            type: notifType,
            title,
            message,
            link,
            entityId: job.entityId,
            entityType: type,
            dedupeKey,
          },
        });
        emitNotificationToUser(userId, toNotificationDto(notification));
        deliveredCount++;
      } catch (recipientError) {
        failedCount++;
        logger.warn({ jobId: job.id, userId, error: recipientError }, "Failed to deliver notification to recipient");
      }
    }

    await prisma.scheduledNotification.update({
      where: { id: job.id },
      data: { status: "COMPLETED", processedAt: new Date() },
    });
  } catch (jobError) {
    error = String(jobError);
    failedCount++;
    await prisma.scheduledNotification.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        lastError: error,
        attemptCount: { increment: 1 },
      },
    }).catch(() => {});
  }

  const durationMs = Date.now() - startTime;

  await prisma.reminderJobRun.create({
    data: {
      jobType: job.jobType,
      candidateCount: 0,
      deliveredCount,
      failedCount,
      durationMs,
      error,
      metadata: { jobId: job.id, entityId: job.entityId },
    },
  });

  logger.info(
    { jobId: job.id, jobType: job.jobType, entityId: job.entityId, deliveredCount, failedCount, durationMs },
    "Reminder job run complete"
  );

  return { deliveredCount, failedCount };
}

function resolveNotificationContent(job: { jobType: string; entityId: string; entityType: string }): [string, string, string, string, "CONTEST_STARTING_SOON" | "HACKATHON_DEADLINE_APPROACHING" | "HACKATHON_STARTING_SOON" | "ASSIGNMENT_DEADLINE_SOON"] {
  switch (job.jobType) {
    case "CONTEST_STARTING_SOON":
      return ["Contest starting soon", "A contest you are registered for is starting soon.", `/contests/${job.entityId}`, "CONTEST", "CONTEST_STARTING_SOON"];
    case "HACKATHON_STARTING_SOON":
      return ["Hackathon starting soon", "A hackathon you are registered for is starting soon.", `/hackathons/${job.entityId}`, "HACKATHON", "HACKATHON_STARTING_SOON"];
    case "ASSIGNMENT_DEADLINE_SOON":
      return ["Assignment due soon", "An assignment you are enrolled in is due within 24 hours.", "/assignments", "ASSIGNMENT", "ASSIGNMENT_DEADLINE_SOON"];
    default:
      return ["Reminder", "You have an upcoming event.", "/", job.entityType, "CONTEST_STARTING_SOON"];
  }
}

// ─── Main job ─────────────────────────────────────────────────────────────────

export async function runEventReminderJob() {
  logger.info("Starting event reminder job");

  try {
    // Step 1: Schedule upcoming events
    await scheduleUpcomingReminders();

    // Step 2: Process due PENDING jobs (up to 50 per tick to avoid blocking)
    const dueJobs = await prisma.scheduledNotification.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        scheduledFor: { lte: new Date() },
        attemptCount: { lt: 3 },
      },
      orderBy: { scheduledFor: "asc" },
      take: 50,
    });

    logger.info({ dueJobCount: dueJobs.length }, "Processing due reminder jobs");

    let totalDelivered = 0;
    let totalFailed = 0;

    for (const job of dueJobs) {
      const result = await deliverJob({
        id: job.id,
        jobType: job.jobType,
        entityType: job.entityType,
        entityId: job.entityId,
        recipientScope: job.recipientScope,
      });
      totalDelivered += result.deliveredCount;
      totalFailed += result.failedCount;
    }

    logger.info({ dueJobCount: dueJobs.length, totalDelivered, totalFailed }, "Event reminder job complete");
    return { dueJobCount: dueJobs.length, totalDelivered, totalFailed };
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : String(err),
      },
      "Event reminder job failed at top level"
    );
    throw err;
  }
}

export function startEventReminderJob() {
  cron.schedule(
    "0 * * * *",
    () => {
      void runEventReminderJob().catch((error: unknown) => {
        logger.error(
          { error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error) },
          "Event reminder job failed"
        );
      });
    },
    { timezone: process.env["TZ"] ?? "Asia/Kolkata" }
  );
  logger.info("Event reminder cron job started (runs hourly)");
}
