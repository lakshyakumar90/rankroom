import cron from "node-cron";
import { prisma } from "@repo/database";
import { logger } from "../lib/logger";
import { recomputeSectionLeaderboard } from "../services/leaderboard.service";

export async function recomputeAllSectionLeaderboards(sectionId?: string) {
  const sectionIds = sectionId
    ? [sectionId]
    : (
        await prisma.section.findMany({
          select: { id: true },
          orderBy: { createdAt: "asc" },
        })
      ).map((section) => section.id);

  const settled = await Promise.allSettled(
    sectionIds.map((currentSectionId) => recomputeSectionLeaderboard(currentSectionId))
  );

  const successCount = settled.filter((result) => result.status === "fulfilled").length;
  const failureCount = settled.length - successCount;

  logger.info({ successCount, failureCount }, "Completed section leaderboard recompute run");

  return { successCount, failureCount };
}

export function startLeaderboardRecomputeJob() {
  cron.schedule(
    "0 */6 * * *",
    () => {
      void recomputeAllSectionLeaderboards().catch((error) => {
        logger.error({ error }, "Leaderboard recompute job failed");
      });
    },
    { timezone: process.env["TZ"] ?? "Asia/Kolkata" }
  );
}
