import "dotenv/config";

import http from "http";
import { createApp } from "./app";
import { initSocket } from "./lib/socket";
import { startSubmissionWorker, startLeaderboardWorker } from "./jobs/submissionWorker";
import { startPlatformSyncJob } from "./jobs/platformSync.job";
import { startLeaderboardRecomputeJob } from "./jobs/leaderboardRecompute.job";
import { startAttendanceAlertJob } from "./jobs/attendanceAlert.job";
import { startEventReminderJob } from "./jobs/eventReminder.job";
import { logger } from "./lib/logger";

const PORT = parseInt(process.env.PORT ?? "4000", 10);

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize Socket.io
  initSocket(server);

  // Start BullMQ workers
  startSubmissionWorker();
  startLeaderboardWorker();

  // Start scheduled jobs
  startPlatformSyncJob();
  startLeaderboardRecomputeJob();
  startAttendanceAlertJob();
  startEventReminderJob();

  server.listen(PORT, () => {
    logger.info(`🚀 API server running on port ${PORT}`);
    logger.info(`   Health: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
}

main().catch((err) => {
  logger.error(err, "Fatal error starting server");
  process.exit(1);
});
