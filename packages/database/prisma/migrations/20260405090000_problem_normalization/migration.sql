-- CreateEnum
CREATE TYPE "ProblemScope" AS ENUM ('GLOBAL', 'DEPARTMENT', 'SECTION');

-- AlterTable
ALTER TABLE "problems"
ADD COLUMN "scope" "ProblemScope" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN "scopeSectionId" TEXT,
ADD COLUMN "scopeDepartmentId" TEXT,
ADD COLUMN "acceptedSubmissions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalSubmissions" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "submissions"
ADD COLUMN "testResults" JSONB,
ADD COLUMN "compileError" TEXT,
ADD COLUMN "stderr" TEXT;

-- CreateTable
CREATE TABLE "problem_boilerplates" (
  "id" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "problem_boilerplates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "problem_hints" (
  "id" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "tier" INTEGER NOT NULL DEFAULT 1,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "problem_hints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "problem_editorials" (
  "id" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "summary" TEXT,
  "approach" TEXT,
  "complexity" TEXT,
  "fullEditorial" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "problem_editorials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "problem_tags" (
  "problemId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "problem_tags_pkey" PRIMARY KEY ("problemId", "tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "problem_boilerplates_problemId_language_key" ON "problem_boilerplates"("problemId", "language");
CREATE UNIQUE INDEX "problem_hints_problemId_tier_key" ON "problem_hints"("problemId", "tier");
CREATE UNIQUE INDEX "problem_editorials_problemId_key" ON "problem_editorials"("problemId");
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- AddForeignKey
ALTER TABLE "problem_boilerplates" ADD CONSTRAINT "problem_boilerplates_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "problem_hints" ADD CONSTRAINT "problem_hints_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "problem_editorials" ADD CONSTRAINT "problem_editorials_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "problem_tags" ADD CONSTRAINT "problem_tags_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "problem_tags" ADD CONSTRAINT "problem_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill scope from existing visibility fields
UPDATE "problems"
SET
  "scope" = CASE
    WHEN "visibility" = 'DEPARTMENT' THEN 'DEPARTMENT'::"ProblemScope"
    WHEN "visibility" = 'CLASS' THEN 'SECTION'::"ProblemScope"
    ELSE 'GLOBAL'::"ProblemScope"
  END,
  "scopeDepartmentId" = CASE WHEN "visibility" = 'DEPARTMENT' THEN "departmentId" ELSE NULL END,
  "scopeSectionId" = CASE WHEN "visibility" = 'CLASS' THEN "classId" ELSE NULL END;

-- Backfill tag catalog and problem-tag mapping from legacy tags array
WITH raw_tags AS (
  SELECT DISTINCT
    TRIM(tag) AS name,
    LOWER(REGEXP_REPLACE(TRIM(tag), '[^a-z0-9]+', '-', 'g')) AS slug
  FROM "problems", UNNEST("tags") AS tag
  WHERE TRIM(tag) <> ''
)
INSERT INTO "tags" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT MD5(slug), INITCAP(name), slug, NOW(), NOW()
FROM raw_tags
WHERE slug <> ''
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "problem_tags" ("problemId", "tagId", "createdAt")
SELECT
  p."id",
  t."id",
  NOW()
FROM "problems" p
CROSS JOIN LATERAL UNNEST(p."tags") AS tag
JOIN "tags" t
  ON t."slug" = LOWER(REGEXP_REPLACE(TRIM(tag), '[^a-z0-9]+', '-', 'g'))
ON CONFLICT ("problemId", "tagId") DO NOTHING;

-- Backfill boilerplates from legacy starterCode JSON map
INSERT INTO "problem_boilerplates" (
  "id",
  "problemId",
  "language",
  "code",
  "createdAt",
  "updatedAt"
)
SELECT
  MD5(p."id" || ':' || kv.key),
  p."id",
  kv.key,
  kv.value,
  NOW(),
  NOW()
FROM "problems" p
CROSS JOIN LATERAL JSONB_EACH_TEXT(COALESCE(p."starterCode", '{}'::jsonb)) AS kv
WHERE JSONB_TYPEOF(COALESCE(p."starterCode", '{}'::jsonb)) = 'object'
ON CONFLICT ("problemId", "language") DO NOTHING;

-- Backfill submission counters
UPDATE "problems" p
SET
  "totalSubmissions" = stats.total,
  "acceptedSubmissions" = stats.accepted
FROM (
  SELECT
    "problemId",
    COUNT(*)::INTEGER AS total,
    COUNT(*) FILTER (WHERE "status" = 'ACCEPTED')::INTEGER AS accepted
  FROM "submissions"
  GROUP BY "problemId"
) stats
WHERE p."id" = stats."problemId";
