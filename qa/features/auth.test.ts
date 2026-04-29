import { dataOf, expectStatus, PASSWORD, request, type TestContext, type TestResult } from "./shared";

export async function runAuthTests(ctx: TestContext, results: TestResult[]) {
  const me = await request("/api/auth/me", { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "auth protected me", me.status, 200, me.body, me.durationMs);

  const refresh = await request("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: "not-a-real-refresh-token" }),
  });
  expectStatus(results, "auth invalid refresh rejected", refresh.status, 401, refresh.body, refresh.durationMs);

  const wrongPassword = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "missing@rankroom.dev", password: "wrong" }),
  });
  expectStatus(results, "auth invalid login rejected", wrongPassword.status, 401, wrongPassword.body, wrongPassword.durationMs);

  const user = dataOf<{ id: string }>(me.body);
  if (!user?.id) {
    results.push({ status: "FAIL", name: "auth me payload", note: "missing user id" });
  }

  const tempEmail = `inactive-${ctx.now}@rankroom.dev`;
  const created = await request("/api/admin/users", {
    method: "POST",
    token: ctx.tokens.ADMIN,
    body: JSON.stringify({
      email: tempEmail,
      name: "Inactive QA User",
      password: PASSWORD,
      role: "STUDENT",
      sectionId: ctx.sectionE2.id,
    }),
  });
  expectStatus(results, "auth admin creates temp user", created.status, [200, 201], created.body, created.durationMs);
  const tempUser = dataOf<{ id: string }>(created.body);

  if (tempUser?.id) {
    const deactivated = await request(`/api/admin/users/${tempUser.id}`, {
      method: "DELETE",
      token: ctx.tokens.ADMIN,
    });
    expectStatus(results, "auth admin deactivates user", deactivated.status, 200, deactivated.body, deactivated.durationMs);

    const inactiveLogin = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: tempEmail, password: PASSWORD }),
    });
    expectStatus(results, "auth deactivated user rejected", inactiveLogin.status, 401, inactiveLogin.body, inactiveLogin.durationMs);
  }
}
