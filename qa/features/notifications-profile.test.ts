import { dataOf, expectStatus, request, type TestContext, type TestResult } from "./shared";

export async function runNotificationsProfileTests(ctx: TestContext, results: TestResult[]) {
  const broadcast = await request("/api/notifications", {
    method: "POST",
    token: ctx.tokens.ADMIN,
    body: JSON.stringify({
      type: "GENERAL",
      title: "QA Broadcast",
      message: "Feature-suite notification broadcast.",
      targetRole: "STUDENT",
    }),
  });
  expectStatus(results, "notification broadcast alias", broadcast.status, [200, 201], broadcast.body, broadcast.durationMs);

  const list = await request("/api/notifications", { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "notification list", list.status, 200, list.body, list.durationMs);
  const first = Array.isArray(dataOf<Array<{ id: string }>>(list.body)) ? dataOf<Array<{ id: string }>>(list.body)?.[0] : null;
  if (first?.id) {
    const read = await request(`/api/notifications/${first.id}/read`, { method: "PATCH", token: ctx.tokens.STUDENT1 });
    expectStatus(results, "notification mark read", read.status, 200, read.body, read.durationMs);
  }

  const profile = await request(`/api/users/${ctx.users.student1.id}/profile`, {
    method: "PATCH",
    token: ctx.tokens.STUDENT1,
    body: JSON.stringify({ githubUsername: "rankroom-qa", leetcodeUsername: "rankroomqa", isPublic: true }),
  });
  expectStatus(results, "profile update alias", profile.status, 200, profile.body, profile.durationMs);
}
