import { expectStatus, request, type TestContext, type TestResult } from "./shared";

export async function runRbacTests(ctx: TestContext, results: TestResult[]) {
  const problemBody = JSON.stringify({
    title: `QA RBAC Problem ${ctx.now}`,
    slug: `qa-rbac-${ctx.now}`,
    description: "Problem used by the RBAC feature test suite.",
    difficulty: "EASY",
    tags: ["qa"],
    scope: "GLOBAL",
    isPublished: true,
  });

  const studentCreate = await request("/api/problems", { method: "POST", token: ctx.tokens.STUDENT1, body: problemBody });
  expectStatus(results, "rbac student cannot create problem", studentCreate.status, 403, studentCreate.body, studentCreate.durationMs);

  const teacherCreate = await request("/api/problems", { method: "POST", token: ctx.tokens.TEACHER1, body: problemBody });
  expectStatus(results, "rbac teacher can create problem", teacherCreate.status, [200, 201, 409], teacherCreate.body, teacherCreate.durationMs);

  const crossSection = await request(`/api/attendance/student/${ctx.users.student3.id}`, { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "rbac student cross-record denied", crossSection.status, [403, 404], crossSection.body, crossSection.durationMs);
}
