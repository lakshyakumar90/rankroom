-- Student profile participation + streak persistence
ALTER TABLE "profiles"
ADD COLUMN "phoneNumber" TEXT;

ALTER TABLE "student_profiles"
ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "longestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastActiveDate" DATE,
ADD COLUMN "avatarPath" TEXT;

-- Contest scope + richer ICPC standings
DO $$ BEGIN
  CREATE TYPE "ContestScope" AS ENUM ('GLOBAL', 'DEPARTMENT', 'SECTION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "contests"
ADD COLUMN "scope" "ContestScope" NOT NULL DEFAULT 'GLOBAL';

ALTER TABLE "contest_standings"
ADD COLUMN "acceptedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "wrongCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "solveTimeSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "perProblemResults" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN "lastAcceptedTime" TIMESTAMP(3);

-- Hackathon registrations become individual snapshots with organiser-managed winners
ALTER TABLE "hackathon_registrations"
ADD COLUMN "phoneNumberSnapshot" TEXT,
ADD COLUMN "avatarUrlSnapshot" TEXT;

CREATE TABLE IF NOT EXISTS "hackathon_winner_entries" (
  "id" TEXT NOT NULL,
  "hackathonId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "teamName" TEXT NOT NULL,
  "projectTitle" TEXT,
  "submissionUrl" TEXT,
  "memberSnapshot" JSONB NOT NULL,
  "notes" TEXT,
  "addedById" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hackathon_winner_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hackathon_winner_entries_hackathonId_rank_key"
ON "hackathon_winner_entries"("hackathonId", "rank");

DO $$ BEGIN
  ALTER TABLE "hackathon_winner_entries"
  ADD CONSTRAINT "hackathon_winner_entries_hackathonId_fkey"
  FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hackathon_winner_entries"
  ADD CONSTRAINT "hackathon_winner_entries_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
