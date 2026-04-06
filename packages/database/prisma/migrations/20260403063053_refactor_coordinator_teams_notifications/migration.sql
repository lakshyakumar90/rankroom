-- CreateEnum
CREATE TYPE "TeamRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'REGISTERED', 'WAITLISTED', 'WITHDRAWN', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScheduledNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TEAM_INVITE_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'TEAM_JOIN_REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'TEAM_REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'TEAM_REQUEST_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'REGISTRATION_CONFIRMED';

-- DropIndex
DROP INDEX "sections_coordinatorId_key";

-- AlterTable
ALTER TABLE "contest_registrations" ADD COLUMN     "eligibilityNote" TEXT,
ADD COLUMN     "registeredById" TEXT,
ADD COLUMN     "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "section_coordinator_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "section_coordinator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" BOOLEAN NOT NULL DEFAULT false,
    "contestReminders" BOOLEAN NOT NULL DEFAULT true,
    "hackathonReminders" BOOLEAN NOT NULL DEFAULT true,
    "assignmentReminders" BOOLEAN NOT NULL DEFAULT true,
    "attendanceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT,
    "publicProfileDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_result_configs" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "maxMidTerm" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "maxEndTerm" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "maxAssignment" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "maxTC" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "credits" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_result_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_audit_logs" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_teams" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT,
    "contestId" TEXT,
    "name" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "submissionUrl" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_team_join_requests" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TeamRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_team_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_team_invites" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "invitedId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "TeamRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_notifications" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "recipientScope" JSONB NOT NULL,
    "status" "ScheduledNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_job_runs" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "reminder_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "section_coordinator_assignments_userId_sectionId_key" ON "section_coordinator_assignments"("userId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_result_configs_subjectId_key" ON "subject_result_configs"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "event_teams_teamCode_key" ON "event_teams"("teamCode");

-- CreateIndex
CREATE UNIQUE INDEX "event_team_members_teamId_userId_key" ON "event_team_members"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_team_join_requests_teamId_userId_key" ON "event_team_join_requests"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_team_invites_teamId_invitedId_key" ON "event_team_invites"("teamId", "invitedId");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_notifications_dedupeKey_key" ON "scheduled_notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "scheduled_notifications_status_scheduledFor_idx" ON "scheduled_notifications"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "notifications_dedupeKey_idx" ON "notifications"("dedupeKey");

-- AddForeignKey
ALTER TABLE "section_coordinator_assignments" ADD CONSTRAINT "section_coordinator_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_coordinator_assignments" ADD CONSTRAINT "section_coordinator_assignments_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_coordinator_assignments" ADD CONSTRAINT "section_coordinator_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_result_configs" ADD CONSTRAINT "subject_result_configs_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_audit_logs" ADD CONSTRAINT "subject_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_audit_logs" ADD CONSTRAINT "subject_audit_logs_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_team_members" ADD CONSTRAINT "event_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "event_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_team_members" ADD CONSTRAINT "event_team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_team_join_requests" ADD CONSTRAINT "event_team_join_requests_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "event_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_team_join_requests" ADD CONSTRAINT "event_team_join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_team_join_requests" ADD CONSTRAINT "event_team_join_requests_respondedBy_fkey" FOREIGN KEY ("respondedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_team_invites" ADD CONSTRAINT "event_team_invites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "event_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_team_invites" ADD CONSTRAINT "event_team_invites_invitedId_fkey" FOREIGN KEY ("invitedId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_team_invites" ADD CONSTRAINT "event_team_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
