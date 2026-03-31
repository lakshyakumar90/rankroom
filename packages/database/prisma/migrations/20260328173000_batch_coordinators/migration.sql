CREATE TABLE IF NOT EXISTS "batch_coordinators" (
  "batchId" TEXT NOT NULL,
  "coordinatorId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "batch_coordinators_pkey" PRIMARY KEY ("batchId","coordinatorId")
);

ALTER TABLE "batch_coordinators"
ADD CONSTRAINT "batch_coordinators_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "batch_coordinators"
ADD CONSTRAINT "batch_coordinators_coordinatorId_fkey"
FOREIGN KEY ("coordinatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
