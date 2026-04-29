import { dataOf, expectStatus, request, type TestContext, type TestResult } from "./shared";

export async function runContestTests(ctx: TestContext, results: TestResult[]) {
  const created = await request("/api/contests", {
    method: "POST",
    token: ctx.tokens.ADMIN,
    body: JSON.stringify({
      title: `QA Contest ${ctx.now}`,
      description: "Feature-suite contest registration and publish check.",
      startTime: new Date(ctx.now + 2 * 60 * 1000).toISOString(),
      endTime: new Date(ctx.now + 62 * 60 * 1000).toISOString(),
      registrationEnd: new Date(ctx.now + 60 * 1000).toISOString(),
      type: "PUBLIC",
      scope: "GLOBAL",
      problemIds: [ctx.helloWorld.id],
      participantIds: [],
    }),
  });
  expectStatus(results, "contest create", created.status, [200, 201], created.body, created.durationMs);
  const contest = dataOf<{ id: string }>(created.body);
  if (!contest?.id) return;

  const registered = await request(`/api/contests/${contest.id}/register`, { method: "POST", token: ctx.tokens.STUDENT1 });
  expectStatus(results, "contest register", registered.status, [200, 201], registered.body, registered.durationMs);

  const standings = await request(`/api/contests/${contest.id}/standings`, { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "contest standings", standings.status, 200, standings.body, standings.durationMs);

  const earlyPublish = await request(`/api/contests/${contest.id}/publish`, { method: "POST", token: ctx.tokens.ADMIN });
  expectStatus(results, "contest publish rejects active contest", earlyPublish.status, 400, earlyPublish.body, earlyPublish.durationMs);

  const ended = await request(`/api/contests/${contest.id}`, {
    method: "PATCH",
    token: ctx.tokens.ADMIN,
    body: JSON.stringify({ status: "ENDED" }),
  });
  expectStatus(results, "contest mark ended", ended.status, 200, ended.body, ended.durationMs);

  const publish = await request(`/api/contests/${contest.id}/publish`, { method: "POST", token: ctx.tokens.ADMIN });
  expectStatus(results, "contest publish alias after ended", publish.status, 200, publish.body, publish.durationMs);
}
