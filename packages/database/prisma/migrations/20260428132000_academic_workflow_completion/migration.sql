ALTER TABLE "subjects"
ADD COLUMN IF NOT EXISTS "minimumAttendancePct" DOUBLE PRECISION NOT NULL DEFAULT 75,
ADD COLUMN IF NOT EXISTS "lateAttendanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

DO $$ BEGIN
  CREATE TYPE "AttendanceExcuseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "attendance_records"
ADD COLUMN IF NOT EXISTS "excuseStatus" "AttendanceExcuseStatus",
ADD COLUMN IF NOT EXISTS "excuseReason" TEXT,
ADD COLUMN IF NOT EXISTS "excuseSubmittedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "excuseReviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "excuseReviewedById" TEXT;

ALTER TABLE "grades"
ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "publishedById" TEXT;

ALTER TABLE "assignments"
ADD COLUMN IF NOT EXISTS "rubric" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "assignment_submissions"
ADD COLUMN IF NOT EXISTS "content" TEXT,
ADD COLUMN IF NOT EXISTS "rubricEvaluation" JSONB,
ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "assignment_extensions" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "extendedDueDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "grantedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "assignment_extensions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "assignment_extensions_assignmentId_studentId_key"
ON "assignment_extensions"("assignmentId", "studentId");

DO $$ BEGIN
  ALTER TABLE "assignment_extensions"
  ADD CONSTRAINT "assignment_extensions_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
