import { authedSocket, dataOf, expectStatus, request, type TestContext, type TestResult } from "./shared";

export async function runCodingTests(ctx: TestContext, results: TestResult[]) {
  const socket = await authedSocket(ctx.tokens.STUDENT1);
  results.push({ status: "PASS", name: "socket authenticated connect", note: "connected" });

  const run = await request(`/api/problems/${ctx.helloWorld.id}/run`, {
    method: "POST",
    token: ctx.tokens.STUDENT1,
    body: JSON.stringify({ language: "python", source_code: "print('Hello, World!')" }),
  });
  expectStatus(results, "coding run mode", run.status, 200, run.body, run.durationMs);

  let verdictEvent: unknown = null;
  const verdictPromise = new Promise<unknown>((resolve) => {
    socket.once("verdict:ready", (payload) => {
      verdictEvent = payload;
      resolve(payload);
    });
    setTimeout(() => resolve(null), 65000);
  });

  const submitted = await request(`/api/problems/${ctx.helloWorld.id}/submit`, {
    method: "POST",
    token: ctx.tokens.STUDENT1,
    body: JSON.stringify({ language: "python", source_code: "print('Hello, World!')" }),
  });
  expectStatus(results, "coding submit mode", submitted.status, [200, 201, 202], submitted.body, submitted.durationMs);
  const submissionId = dataOf<{ submissionId?: string; id?: string }>(submitted.body)?.submissionId ?? dataOf<{ id?: string }>(submitted.body)?.id;
  if (submissionId) socket.emit("submission:join", { submissionId });

  await verdictPromise;
  results.push({
    status: verdictEvent ? "PASS" : "FAIL",
    name: "coding verdict socket",
    note: verdictEvent ? "verdict:ready received" : "verdict:ready timed out",
  });
  socket.disconnect();
}
