import cron from "node-cron";
import { logger } from "../lib/logger";
import { recomputeAllStudentIntelligence } from "../services/student-intelligence.service";

export function startStudentIntelligenceJob() {
  cron.schedule(
    "30 2 * * *",
    () => {
      void recomputeAllStudentIntelligence()
        .then((result) => {
          logger.info(result, "Student intelligence job completed");
        })
        .catch((error) => {
          logger.error({ error }, "Student intelligence job failed");
        });
    },
    { timezone: process.env["TZ"] ?? "Asia/Kolkata" }
  );
}
