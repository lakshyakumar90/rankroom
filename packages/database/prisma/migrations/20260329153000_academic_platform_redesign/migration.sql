DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkillLevel') THEN
    CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HackathonStatus') THEN
    CREATE TYPE "HackathonStatus" AS ENUM ('DRAFT', 'UPCOMING', 'REGISTRATION_OPEN', 'ONGOING', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompetitionType') THEN
    CREATE TYPE "CompetitionType" AS ENUM ('CODING', 'DESIGN', 'PRESENTATION', 'QUIZ', 'OTHER');
  END IF;
END $$;

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_GRADED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTEST_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTEST_STARTING_SOON';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTEST_ENDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HACKATHON_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HACKATHON_REGISTRATION_OPEN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'HACKATHON_DEADLINE_APPROACHING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPETITION_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBMISSION_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEADERBOARD_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_LOW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';

ALTER TABLE "departments"
  ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "entityId" TEXT,
  ADD COLUMN IF NOT EXISTS "entityType" TEXT,
  ADD COLUMN IF NOT EXISTS "targetDepartmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetRole" "Role",
  ADD COLUMN IF NOT EXISTS "targetSectionId" TEXT;

ALTER TABLE "batches" RENAME TO "sections";
ALTER TABLE "attendance" RENAME TO "attendance_sessions";

ALTER TABLE "sections"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "academicYear" TEXT,
  ADD COLUMN IF NOT EXISTS "coordinatorId" TEXT;

ALTER TABLE "sections"
  ALTER COLUMN "teacherId" DROP NOT NULL,
  ALTER COLUMN "year" DROP NOT NULL;

UPDATE "sections"
SET "code" = COALESCE(
  NULLIF(
    UPPER(
      REGEXP_REPLACE(
        COALESCE(SUBSTRING("name" FROM 'Section[[:space:]]+(.+)$'), SPLIT_PART("name", '-', array_length(string_to_array("name", '-'), 1))),
        '[^A-Za-z0-9]+',
        '',
        'g'
      )
    ),
    ''
  ),
  UPPER(SUBSTRING("id" FROM 1 FOR 6))
);

UPDATE "sections"
SET "academicYear" = COALESCE(
  "academicYear",
  CASE
    WHEN "year" IS NOT NULL THEN CONCAT("year", '-', LPAD(((("year" + 1) % 100))::text, 2, '0'))
    ELSE CONCAT(EXTRACT(YEAR FROM CURRENT_DATE)::int, '-', LPAD((((EXTRACT(YEAR FROM CURRENT_DATE)::int + 1) % 100))::text, 2, '0'))
  END
);

UPDATE "sections" s
SET "coordinatorId" = bc."coordinatorId"
FROM (
  SELECT DISTINCT ON ("batchId") "batchId", "coordinatorId"
  FROM "batch_coordinators"
  ORDER BY "batchId", "assignedAt" ASC
) bc
WHERE s."id" = bc."batchId" AND s."coordinatorId" IS NULL;

ALTER TABLE "sections"
  ALTER COLUMN "code" SET NOT NULL,
  ALTER COLUMN "academicYear" SET NOT NULL;

ALTER TABLE "enrollments" RENAME COLUMN "batchId" TO "sectionId";
ALTER TABLE "subjects" RENAME COLUMN "batchId" TO "sectionId";
ALTER TABLE "subjects" ALTER COLUMN "teacherId" DROP NOT NULL;
ALTER TABLE "attendance_sessions" RENAME COLUMN "batchId" TO "sectionId";
ALTER TABLE "attendance_sessions" RENAME COLUMN "teacherId" TO "takenById";
ALTER TABLE "attendance_sessions" ADD COLUMN IF NOT EXISTS "topic" TEXT;
ALTER TABLE "attendance_records" RENAME COLUMN "attendanceId" TO "attendanceSessionId";

DROP INDEX IF EXISTS "enrollments_studentId_batchId_key";
DROP INDEX IF EXISTS "subjects_code_batchId_key";
DROP INDEX IF EXISTS "attendance_records_attendanceId_studentId_key";
DROP INDEX IF EXISTS "attendance_date_batchId_subjectId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "sections_coordinatorId_key" ON "sections"("coordinatorId");
CREATE UNIQUE INDEX IF NOT EXISTS "sections_code_departmentId_academicYear_key" ON "sections"("code", "departmentId", "academicYear");
CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_studentId_sectionId_key" ON "enrollments"("studentId", "sectionId");
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_code_sectionId_key" ON "subjects"("code", "sectionId");
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_attendanceSessionId_studentId_key" ON "attendance_records"("attendanceSessionId", "studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_sectionId_subjectId_date_key" ON "attendance_sessions"("sectionId", "subjectId", "date");

ALTER TABLE "contests"
  ADD COLUMN IF NOT EXISTS "sectionId" TEXT;

CREATE TABLE IF NOT EXISTS "student_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leetcodeUsername" TEXT,
  "githubUsername" TEXT,
  "codechefUsername" TEXT,
  "codeforcesUsername" TEXT,
  "hackerrankUsername" TEXT,
  "leetcodeSolved" INTEGER NOT NULL DEFAULT 0,
  "leetcodeEasy" INTEGER NOT NULL DEFAULT 0,
  "leetcodeMedium" INTEGER NOT NULL DEFAULT 0,
  "leetcodeHard" INTEGER NOT NULL DEFAULT 0,
  "leetcodeAcceptanceRate" DOUBLE PRECISION,
  "githubContributions" INTEGER NOT NULL DEFAULT 0,
  "githubTopLanguages" JSONB NOT NULL DEFAULT '[]',
  "codechefRating" INTEGER,
  "codechefMaxRating" INTEGER,
  "codechefStars" INTEGER,
  "codeforcesRating" INTEGER,
  "codeforcesMaxRating" INTEGER,
  "codeforcesRank" TEXT,
  "cgpa" DOUBLE PRECISION,
  "activityHeatmap" JSONB NOT NULL DEFAULT '{}',
  "lastSyncedAt" TIMESTAMP(3),
  "bio" TEXT,
  "resumeUrl" TEXT,
  "resumeFilename" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_profiles_userId_key" ON "student_profiles"("userId");

INSERT INTO "student_profiles" (
  "id",
  "userId",
  "githubUsername",
  "bio",
  "isPublic",
  "createdAt",
  "updatedAt"
)
SELECT
  'sp_' || u."id",
  u."id",
  u."githubUsername",
  p."bio",
  COALESCE(p."isPublic", TRUE),
  COALESCE(p."createdAt", CURRENT_TIMESTAMP),
  COALESCE(p."updatedAt", CURRENT_TIMESTAMP)
FROM "users" u
LEFT JOIN "profiles" p ON p."userId" = u."id"
WHERE u."role" = 'STUDENT'
  AND NOT EXISTS (
    SELECT 1
    FROM "student_profiles" sp
    WHERE sp."userId" = u."id"
  );

CREATE TABLE IF NOT EXISTS "skills" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "level" "SkillLevel" NOT NULL DEFAULT 'BEGINNER',
  "profileId" TEXT NOT NULL,
  CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "skills_name_profileId_key" ON "skills"("name", "profileId");

CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "techStack" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "githubUrl" TEXT,
  "liveUrl" TEXT,
  "imageUrl" TEXT,
  "featured" BOOLEAN NOT NULL DEFAULT FALSE,
  "profileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "achievements" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "certificateUrl" TEXT,
  "profileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "teacher_subject_assignments" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_subject_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_subject_assignments_teacherId_subjectId_sectionId_key"
  ON "teacher_subject_assignments"("teacherId", "subjectId", "sectionId");

INSERT INTO "teacher_subject_assignments" ("id", "teacherId", "subjectId", "sectionId", "createdAt")
SELECT
  'tsa_' || "id",
  "teacherId",
  "id",
  "sectionId",
  CURRENT_TIMESTAMP
FROM "subjects"
WHERE "teacherId" IS NOT NULL
ON CONFLICT ("teacherId", "subjectId", "sectionId") DO NOTHING;

CREATE TABLE IF NOT EXISTS "hackathons" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "departmentId" TEXT,
  "createdById" TEXT NOT NULL,
  "minSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "minProjects" INTEGER NOT NULL DEFAULT 0,
  "minLeetcode" INTEGER NOT NULL DEFAULT 0,
  "minCgpa" DOUBLE PRECISION,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "registrationDeadline" TIMESTAMP(3) NOT NULL,
  "maxTeamSize" INTEGER NOT NULL DEFAULT 4,
  "minTeamSize" INTEGER NOT NULL DEFAULT 1,
  "prizeDetails" TEXT,
  "status" "HackathonStatus" NOT NULL DEFAULT 'UPCOMING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hackathons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hackathon_teams" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "teamCode" TEXT NOT NULL,
  "hackathonId" TEXT NOT NULL,
  "leaderId" TEXT NOT NULL,
  "submissionUrl" TEXT,
  "rank" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hackathon_teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hackathon_teams_teamCode_key" ON "hackathon_teams"("teamCode");

CREATE TABLE IF NOT EXISTS "hackathon_registrations" (
  "id" TEXT NOT NULL,
  "hackathonId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "teamId" TEXT,
  "isEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  "eligibilityNote" TEXT,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hackathon_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hackathon_registrations_hackathonId_studentId_key"
  ON "hackathon_registrations"("hackathonId", "studentId");

CREATE TABLE IF NOT EXISTS "competitions" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "departmentId" TEXT,
  "sectionId" TEXT,
  "createdById" TEXT NOT NULL,
  "type" "CompetitionType" NOT NULL,
  "minSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "minProjects" INTEGER NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "HackathonStatus" NOT NULL DEFAULT 'UPCOMING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "competition_registrations" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "isEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competition_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "competition_registrations_competitionId_studentId_key"
  ON "competition_registrations"("competitionId", "studentId");

CREATE TABLE IF NOT EXISTS "section_leaderboard" (
  "id" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "cgpaScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "codingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "assignmentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hackathonScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profileScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "externalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rank" INTEGER,
  "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "section_leaderboard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "section_leaderboard_sectionId_studentId_key"
  ON "section_leaderboard"("sectionId", "studentId");

DROP TABLE "batch_coordinators";

ALTER TABLE "sections"
  ADD CONSTRAINT "sections_coordinatorId_fkey"
  FOREIGN KEY ("coordinatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_profiles"
  ADD CONSTRAINT "student_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skills"
  ADD CONSTRAINT "skills_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "achievements"
  ADD CONSTRAINT "achievements_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_subject_assignments"
  ADD CONSTRAINT "teacher_subject_assignments_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "teacher_subject_assignments_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "teacher_subject_assignments_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contests"
  ADD CONSTRAINT "contests_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hackathons"
  ADD CONSTRAINT "hackathons_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "hackathons_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hackathon_teams"
  ADD CONSTRAINT "hackathon_teams_hackathonId_fkey"
  FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "hackathon_teams_leaderId_fkey"
  FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hackathon_registrations"
  ADD CONSTRAINT "hackathon_registrations_hackathonId_fkey"
  FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "hackathon_registrations_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "hackathon_registrations_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "hackathon_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "competitions"
  ADD CONSTRAINT "competitions_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "competitions_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "competitions_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competition_registrations"
  ADD CONSTRAINT "competition_registrations_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "competition_registrations_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "section_leaderboard"
  ADD CONSTRAINT "section_leaderboard_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "section_leaderboard_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_targetSectionId_fkey"
  FOREIGN KEY ("targetSectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "notifications_targetDepartmentId_fkey"
  FOREIGN KEY ("targetDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
