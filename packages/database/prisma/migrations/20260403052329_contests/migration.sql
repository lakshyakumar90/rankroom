-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('CODING', 'FILE_UPLOAD', 'MCQ', 'MIXED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('CREATED', 'ACTIVE', 'DEADLINE_EXPIRED', 'EVALUATION', 'RESULTS_PUBLISHED');

-- CreateEnum
CREATE TYPE "ProblemVisibility" AS ENUM ('GLOBAL', 'DEPARTMENT', 'CLASS', 'CONTEST_ONLY', 'ASSIGNMENT_ONLY');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HackathonType" AS ENUM ('DSA', 'PROJECT');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('CONTEST_WINNER', 'HACKATHON', 'PROBLEM_STREAK', 'EXTERNAL', 'ACADEMIC_EXCELLENCE');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContestStatus" ADD VALUE 'DRAFT';
ALTER TYPE "ContestStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "ContestStatus" ADD VALUE 'REGISTRATION_OPEN';
ALTER TYPE "ContestStatus" ADD VALUE 'FROZEN';
ALTER TYPE "ContestStatus" ADD VALUE 'RESULTS_PUBLISHED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContestType" ADD VALUE 'SUBJECT';
ALTER TYPE "ContestType" ADD VALUE 'DEPARTMENT';
ALTER TYPE "ContestType" ADD VALUE 'INSTITUTION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CERTIFICATE_EARNED';
ALTER TYPE "NotificationType" ADD VALUE 'CERTIFICATE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'CERTIFICATE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_DEADLINE_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'HACKATHON_STARTING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'CONTEST_FROZEN';
ALTER TYPE "NotificationType" ADD VALUE 'RANK_CHANGE';

-- AlterTable
ALTER TABLE "assignment_submissions" ADD COLUMN     "codeSubmissions" JSONB,
ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "gradedById" TEXT,
ADD COLUMN     "isLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mcqAnswers" JSONB;

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "allowLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latePenaltyPct" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'CREATED',
ADD COLUMN     "type" "AssignmentType" NOT NULL DEFAULT 'FILE_UPLOAD',
ADD COLUMN     "xpWeight" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "contests" ADD COLUMN     "aiDisabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowLateJoin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "freezeTime" TIMESTAMP(3),
ADD COLUMN     "maxParticipants" INTEGER,
ADD COLUMN     "penaltyMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "registrationEnd" TIMESTAMP(3),
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "xpReward" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "hackathons" ADD COLUMN     "eligibility" JSONB,
ADD COLUMN     "freezeTime" TIMESTAMP(3),
ADD COLUMN     "type" "HackathonType" NOT NULL DEFAULT 'DSA',
ADD COLUMN     "xpRewards" JSONB;

-- AlterTable
ALTER TABLE "problems" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "classId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "visibility" "ProblemVisibility" NOT NULL DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "hackathonId" TEXT;

-- CreateTable
CREATE TABLE "assignment_problems" (
    "assignmentId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "assignment_problems_pkey" PRIMARY KEY ("assignmentId","problemId")
);

-- CreateTable
CREATE TABLE "assignment_questions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hackathon_problems" (
    "hackathonId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "hackathon_problems_pkey" PRIMARY KEY ("hackathonId","problemId")
);

-- CreateTable
CREATE TABLE "hackathon_standings" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "penalty" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "lastSubmitTime" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hackathon_standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalUrl" TEXT,
    "proofFile" TEXT,
    "status" "CertStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "xpBonus" INTEGER NOT NULL DEFAULT 0,
    "verificationCode" TEXT,
    "certificateUrl" TEXT,
    "contestId" TEXT,
    "hackathonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hackathon_standings_hackathonId_userId_key" ON "hackathon_standings"("hackathonId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verificationCode_key" ON "certificates"("verificationCode");

-- AddForeignKey
ALTER TABLE "assignment_problems" ADD CONSTRAINT "assignment_problems_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_problems" ADD CONSTRAINT "assignment_problems_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_questions" ADD CONSTRAINT "assignment_questions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_classId_fkey" FOREIGN KEY ("classId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathon_problems" ADD CONSTRAINT "hackathon_problems_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathon_problems" ADD CONSTRAINT "hackathon_problems_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathon_standings" ADD CONSTRAINT "hackathon_standings_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathon_standings" ADD CONSTRAINT "hackathon_standings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
