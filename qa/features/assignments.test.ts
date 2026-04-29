import { dataOf, expectStatus, request, type TestContext, type TestResult } from "./shared";

export async function runAssignmentTests(ctx: TestContext, results: TestResult[]) {
  const created = await request("/api/assignments", {
    method: "POST",
    token: ctx.tokens.TEACHER1,
    body: JSON.stringify({
      title: `QA Assignment ${ctx.now}`,
      description: "Feature-suite assignment lifecycle check.",
      subjectId: ctx.webTech.id,
      dueDate: new Date(ctx.now + 24 * 60 * 60 * 1000).toISOString(),
      maxScore: 100,
    }),
  });
  expectStatus(results, "assignment create", created.status, [200, 201], created.body, created.durationMs);
  const assignment = dataOf<{ id: string }>(created.body);
  if (!assignment?.id) return;

  const visible = await request(`/api/assignments/${assignment.id}`, { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "assignment student view", visible.status, 200, visible.body, visible.durationMs);

  const emptySubmission = await request(`/api/assignments/${assignment.id}/submit`, {
    method: "POST",
    token: ctx.tokens.STUDENT1,
    body: JSON.stringify({}),
  });
  expectStatus(
    results,
    "assignment submit requires content or file",
    emptySubmission.status,
    400,
    emptySubmission.body,
    emptySubmission.durationMs
  );

  const submitted = await request(`/api/assignments/${assignment.id}/submit`, {
    method: "POST",
    token: ctx.tokens.STUDENT1,
    body: JSON.stringify({ content: "QA solution" }),
  });
  expectStatus(results, "assignment submit", submitted.status, [200, 201], submitted.body, submitted.durationMs);
  const submission = dataOf<{ id: string }>(submitted.body);

  if (!submission?.id) return;

  const graded = await request(`/api/assignments/${assignment.id}/grade/${submission.id}`, {
    method: "PATCH",
    token: ctx.tokens.TEACHER1,
    body: JSON.stringify({
      score: 92,
      feedback: "Strong QA submission.",
      rubricEvaluation: { correctness: true },
    }),
  });
  expectStatus(results, "assignment grade draft", graded.status, 200, graded.body, graded.durationMs);

  const hiddenGrade = await request(`/api/assignments/${assignment.id}`, { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "assignment draft grade hidden", hiddenGrade.status, 200, hiddenGrade.body, hiddenGrade.durationMs);
  const hiddenPayload = dataOf<{ mySubmission?: { score?: number | null } }>(hiddenGrade.body);
  results.push({
    status: hiddenPayload?.mySubmission?.score == null ? "PASS" : "FAIL",
    name: "assignment score hidden before publish",
    note: hiddenPayload?.mySubmission?.score == null ? "score hidden" : `score was visible: ${hiddenPayload?.mySubmission?.score}`,
  });

  const published = await request(`/api/assignments/${assignment.id}/publish`, {
    method: "POST",
    token: ctx.tokens.TEACHER1,
  });
  expectStatus(results, "assignment publish grades", published.status, 200, published.body, published.durationMs);

  const visibleGrade = await request(`/api/assignments/${assignment.id}`, { token: ctx.tokens.STUDENT1 });
  expectStatus(results, "assignment published grade visible", visibleGrade.status, 200, visibleGrade.body, visibleGrade.durationMs);
  const visiblePayload = dataOf<{ mySubmission?: { score?: number | null } }>(visibleGrade.body);
  results.push({
    status: visiblePayload?.mySubmission?.score === 92 ? "PASS" : "FAIL",
    name: "assignment score visible after publish",
    note: visiblePayload?.mySubmission?.score === 92 ? "score visible" : `unexpected score: ${visiblePayload?.mySubmission?.score}`,
  });
}
