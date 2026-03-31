-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "batches_teacherId_fkey";

-- AlterTable
ALTER TABLE "achievements" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "attendance_sessions" RENAME CONSTRAINT "attendance_pkey" TO "attendance_sessions_pkey";

-- AlterTable
ALTER TABLE "competitions" ALTER COLUMN "minSkills" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hackathons" ALTER COLUMN "minSkills" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "techStack" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "section_leaderboard" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sections" RENAME CONSTRAINT "batches_pkey" TO "sections_pkey";

-- AlterTable
ALTER TABLE "student_profiles" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "attendance_records" RENAME CONSTRAINT "attendance_records_attendanceId_fkey" TO "attendance_records_attendanceSessionId_fkey";

-- RenameForeignKey
ALTER TABLE "attendance_sessions" RENAME CONSTRAINT "attendance_batchId_fkey" TO "attendance_sessions_sectionId_fkey";

-- RenameForeignKey
ALTER TABLE "attendance_sessions" RENAME CONSTRAINT "attendance_subjectId_fkey" TO "attendance_sessions_subjectId_fkey";

-- RenameForeignKey
ALTER TABLE "attendance_sessions" RENAME CONSTRAINT "attendance_teacherId_fkey" TO "attendance_sessions_takenById_fkey";

-- RenameForeignKey
ALTER TABLE "enrollments" RENAME CONSTRAINT "enrollments_batchId_fkey" TO "enrollments_sectionId_fkey";

-- RenameForeignKey
ALTER TABLE "sections" RENAME CONSTRAINT "batches_departmentId_fkey" TO "sections_departmentId_fkey";

-- RenameForeignKey
ALTER TABLE "subjects" RENAME CONSTRAINT "subjects_batchId_fkey" TO "subjects_sectionId_fkey";

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
