import { runAnalyticsLeaderboardTests } from "./analytics-leaderboard.test";
import { runAssignmentTests } from "./assignments.test";
import { runAuthTests } from "./auth.test";
import { runCodingTests } from "./coding.test";
import { runContestTests } from "./contests.test";
import { runHackathonTests } from "./hackathons.test";
import { runNotificationsProfileTests } from "./notifications-profile.test";
import { runRbacTests } from "./rbac.test";
import {
  disconnectPrisma,
  ensureParticipationReady,
  loadSeedIds,
  loginAll,
  type TestContext,
  type TestResult,
} from "./shared";

const results: TestResult[] = [];

async function runFeature(name: string, runner: (ctx: TestContext, results: TestResult[]) => Promise<void>, ctx: TestContext) {
  const before = results.length;
  try {
    await runner(ctx, results);
  } catch (error) {
    results.push({
      status: "FAIL",
      name,
      note: error instanceof Error ? error.stack ?? error.message : String(error),
    });
  }

  for (const result of results.slice(before)) {
    console.log(`${result.status} — ${result.name} — ${result.note}${result.durationMs !== undefined ? ` (${result.durationMs}ms)` : ""}`);
  }
}

async function main() {
  const tokens = await loginAll(results);
  const ids = await loadSeedIds();
  const ctx: TestContext = {
    tokens,
    ...ids,
    now: Date.now(),
  };

  await ensureParticipationReady(ctx, results);
  await runFeature("auth", runAuthTests, ctx);
  await runFeature("rbac", runRbacTests, ctx);
  await runFeature("assignments", runAssignmentTests, ctx);
  await runFeature("coding", runCodingTests, ctx);
  await runFeature("contests", runContestTests, ctx);
  await runFeature("hackathons", runHackathonTests, ctx);
  await runFeature("analytics-leaderboard", runAnalyticsLeaderboardTests, ctx);
  await runFeature("notifications-profile", runNotificationsProfileTests, ctx);

  const failed = results.filter((result) => result.status === "FAIL");
  console.log(
    "QA_FEATURE_SUMMARY",
    JSON.stringify(
      {
        total: results.length,
        pass: results.length - failed.length,
        fail: failed.length,
        failed,
      },
      null,
      2
    )
  );

  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
