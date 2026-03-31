CREATE TABLE IF NOT EXISTS "assignment_audience" (
  "assignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignment_audience_pkey" PRIMARY KEY ("assignmentId", "studentId"),
  CONSTRAINT "assignment_audience_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assignment_audience_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "contest_audience" (
  "contestId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contest_audience_pkey" PRIMARY KEY ("contestId", "studentId"),
  CONSTRAINT "contest_audience_contestId_fkey"
    FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contest_audience_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "hackathon_audience" (
  "hackathonId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hackathon_audience_pkey" PRIMARY KEY ("hackathonId", "studentId"),
  CONSTRAINT "hackathon_audience_hackathonId_fkey"
    FOREIGN KEY ("hackathonId") REFERENCES "hackathons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "hackathon_audience_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
