CREATE TABLE "user_skill_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "skills" JSONB NOT NULL DEFAULT '{}',
  "activityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_skill_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_skill_snapshots" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "snapshotDate" DATE NOT NULL,
  "skillsSnapshot" JSONB NOT NULL DEFAULT '{}',
  "activityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_skill_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_advice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "adviceDate" DATE NOT NULL,
  "warning" TEXT NOT NULL,
  "motivation" TEXT NOT NULL,
  "tasks" TEXT[] NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coach_advice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_skill_profiles_userId_key" ON "user_skill_profiles"("userId");
CREATE UNIQUE INDEX "user_skill_snapshots_userId_snapshotDate_key" ON "user_skill_snapshots"("userId", "snapshotDate");
CREATE UNIQUE INDEX "coach_advice_userId_adviceDate_key" ON "coach_advice"("userId", "adviceDate");

ALTER TABLE "user_skill_profiles"
ADD CONSTRAINT "user_skill_profiles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_skill_snapshots"
ADD CONSTRAINT "user_skill_snapshots_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coach_advice"
ADD CONSTRAINT "coach_advice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COACH_ADVICE_READY';
