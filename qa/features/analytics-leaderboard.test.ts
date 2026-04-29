import { expectStatus, request, type TestContext, type TestResult } from "./shared";

export async function runAnalyticsLeaderboardTests(ctx: TestContext, results: TestResult[]) {
  const global = await request("/api/leaderboard/global", { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "leaderboard global", global.status, 200, global.body, global.durationMs);

  const section = await request(`/api/leaderboard/section/${ctx.sectionE2.id}`, { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "leaderboard section", section.status, 200, section.body, section.durationMs);

  const atRisk = await request(`/api/analytics/section/${ctx.sectionE2.id}/at-risk`, { token: ctx.tokens.COORD });
  expectStatus(results, "analytics at-risk", atRisk.status, 200, atRisk.body, atRisk.durationMs);

  const studentAnalytics = await request(`/api/analytics/section/${ctx.sectionE2.id}`, { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "analytics student forbidden", studentAnalytics.status, 403, studentAnalytics.body, studentAnalytics.durationMs);
}
