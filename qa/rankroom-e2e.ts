import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { io } from "socket.io-client";
import { prisma } from "../packages/database/src/index";

loadEnv({ path: "packages/database/.env", override: false });
loadEnv({ path: "apps/api/.env", override: false });

type TestStatus = "PASS" | "FAIL" | "PARTIAL";
type TestResult = {
  status: TestStatus;
  name: string;
  note: string;
  durationMs?: number;
};

const API = process.env.API_URL ?? "http://localhost:4000";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
const PASSWORD = process.env.SEED_USER_PASSWORD || "RankRoomSeed#2026";
const results: TestResult[] = [];
const endpointTimings: Array<{ path: string; ms: number }> = [];

const emails = {
  SUPER_ADMIN: "superadmin@rankroom.dev",
  ADMIN: "admin@rankroom.dev",
  HOD: "meera.sharma@rankroom.dev",
  COORD: "arjun.rao@rankroom.dev",
  TEACHER1: "kavya.nair@rankroom.dev",
  TEACHER2: "rohan.das@rankroom.dev",
  STUDENT1: "aarav.patel@rankroom.dev",
  STUDENT2: "diya.menon@rankroom.dev",
  STUDENT3: "vihaan.gupta@rankroom.dev",
} as const;

type TokenKey = keyof typeof emails;
const tokens: Partial<Record<TokenKey, string>> = {};

function record(status: TestStatus, name: string, note: string, durationMs?: number) {
  results.push({ status, name, note, durationMs });
  const icon = status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "PARTIAL";
  console.log(`${icon} — ${name} — ${note}${durationMs !== undefined ? ` (${durationMs}ms)` : ""}`);
}

function expectStatus(name: string, actual: number, expected: number | number[], body: unknown, durationMs?: number) {
  const expectedList = Array.isArray(expected) ? expected : [expected];
  if (expectedList.includes(actual)) {
    record("PASS", name, `HTTP ${actual} as expected`, durationMs);
  } else {
    record("FAIL", name, `expected ${expectedList.join("/")} but got ${actual}; body=${JSON.stringify(body).slice(0, 500)}`, durationMs);
  }
}

async function request(path: string, init: RequestInit & { token?: string } = {}) {
  const started = Date.now();
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  const durationMs = Date.now() - started;
  endpointTimings.push({ path, ms: durationMs });
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, durationMs };
}

function dataOf<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  return (body as { data?: T }).data ?? null;
}

async function signInAll() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase auth env for login tests");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  for (const [keyName, email] of Object.entries(emails) as Array<[TokenKey, string]>) {
    const started = Date.now();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
    if (error || !data.session?.access_token) {
      record("FAIL", `Phase 2.7 login ${keyName}`, error?.message ?? "no access token", Date.now() - started);
      continue;
    }
    tokens[keyName] = data.session.access_token;
    record("PASS", `Phase 2.7 login ${keyName}`, `token acquired for ${email}`, Date.now() - started);
  }
}

async function ids() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const engineering = await prisma.department.findFirstOrThrow({ where: { name: "Engineering" } });
  const sectionE2 = await prisma.section.findFirstOrThrow({ where: { code: "E2" } });
  const sectionE3 = await prisma.section.findFirstOrThrow({ where: { code: "E3" } });
  const dataStructures = await prisma.subject.findFirstOrThrow({ where: { code: "DS402" } });
  const webTech = await prisma.subject.findFirstOrThrow({ where: { code: "WT401" } });
  const helloWorld = await prisma.problem.findFirstOrThrow({ where: { slug: "hello-world" } });
  return {
    users: {
      superAdmin: byEmail.get(emails.SUPER_ADMIN)!,
      admin: byEmail.get(emails.ADMIN)!,
      hod: byEmail.get(emails.HOD)!,
      coord: byEmail.get(emails.COORD)!,
      teacher1: byEmail.get(emails.TEACHER1)!,
      teacher2: byEmail.get(emails.TEACHER2)!,
      student1: byEmail.get(emails.STUDENT1)!,
      student2: byEmail.get(emails.STUDENT2)!,
      student3: byEmail.get(emails.STUDENT3)!,
    },
    engineering,
    sectionE2,
    sectionE3,
    dataStructures,
    webTech,
    helloWorld,
  };
}

async function waitForSubmission(submissionId: string, token: string, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await request(`/api/submissions/${submissionId}`, { token });
    const data = dataOf<{ verdict: string; status: string }>(res.body);
    if (data && data.verdict !== "PENDING" && data.verdict !== "JUDGING") {
      return { data, ms: Date.now() - started };
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
}

async function main() {
  const seeded = await ids();
  console.log("SEEDED_IDS", JSON.stringify(seeded, null, 2));
  await signInAll();

  // Phase 2: prompt auth contract plus actual token path.
  expectStatus("Test 2.1 POST /api/auth/login valid credentials", (await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: emails.STUDENT1, password: PASSWORD }),
  })).status, 200, "login endpoint");
  const wrongLogin = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email: emails.STUDENT1, password: "wrongpassword" }) });
  expectStatus("Test 2.2 POST /api/auth/login wrong password", wrongLogin.status, 401, wrongLogin.body, wrongLogin.durationMs);
  const ghostLogin = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "ghost@test.com", password: PASSWORD }) });
  expectStatus("Test 2.3 POST /api/auth/login non-existent email", ghostLogin.status, 401, ghostLogin.body, ghostLogin.durationMs);
  const noToken = await request("/api/users/search");
  expectStatus("Test 2.4 protected route without token", noToken.status, 401, noToken.body, noToken.durationMs);
  const malformed = await request("/api/users/search", { token: "invalidtoken123" });
  expectStatus("Test 2.5 protected route malformed token", malformed.status, 401, malformed.body, malformed.durationMs);
  const refresh = await request("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: "placeholder" }) });
  expectStatus("Test 2.6 POST /api/auth/refresh", refresh.status, 200, refresh.body, refresh.durationMs);

  // Phase 3 RBAC: actual admin user endpoint.
  for (const key of ["STUDENT1", "TEACHER1", "HOD", "COORD"] as TokenKey[]) {
    const res = await request("/api/admin/users", {
      method: "POST",
      token: tokens[key],
      body: JSON.stringify({ email: `qa-${key.toLowerCase()}-${Date.now()}@rankroom.dev`, name: `QA ${key}`, role: "STUDENT", password: PASSWORD }),
    });
    expectStatus(`Test 3.1 user create forbidden for ${key}`, res.status, 403, res.body, res.durationMs);
  }
  for (const key of ["ADMIN", "SUPER_ADMIN"] as TokenKey[]) {
    const res = await request("/api/admin/users", {
      method: "POST",
      token: tokens[key],
      body: JSON.stringify({ email: `qa-${key.toLowerCase()}-${Date.now()}@rankroom.dev`, name: `QA ${key}`, role: "STUDENT", password: PASSWORD }),
    });
    expectStatus(`Test 3.1 user create allowed for ${key}`, res.status, [200, 201], res.body, res.durationMs);
  }

  const attendancePayload = (subjectId: string) => JSON.stringify({
    sectionId: seeded.sectionE2.id,
    subjectId,
    date: new Date().toISOString(),
    topic: "QA attendance",
    records: [
      { studentId: seeded.users.student1.id, status: "PRESENT" },
      { studentId: seeded.users.student2.id, status: "ABSENT" },
      { studentId: seeded.users.student3.id, status: "PRESENT" },
    ],
  });
  expectStatus("Test 3.2 student cannot record attendance", (await request("/api/attendance/session", { method: "POST", token: tokens.STUDENT1, body: attendancePayload(seeded.dataStructures.id) })).status, 403, "student attendance");
  expectStatus("Test 3.2 teacher1 cannot record Data Structures", (await request("/api/attendance/session", { method: "POST", token: tokens.TEACHER1, body: attendancePayload(seeded.dataStructures.id) })).status, 403, "teacher1 wrong subject");
  const attendanceOk = await request("/api/attendance/session", { method: "POST", token: tokens.TEACHER2, body: attendancePayload(seeded.dataStructures.id) });
  expectStatus("Test 3.2 teacher2 can record Data Structures", attendanceOk.status, [200, 201], attendanceOk.body, attendanceOk.durationMs);

  const gradeBody = JSON.stringify({ studentId: seeded.users.student1.id, subjectId: seeded.dataStructures.id, examType: "MID", marks: 18, maxMarks: 20, semester: 4 });
  expectStatus("Test 3.3 student cannot enter grade", (await request("/api/grades", { method: "POST", token: tokens.STUDENT1, body: gradeBody })).status, 403, "student grade");
  expectStatus("Test 3.3 teacher1 cannot grade Data Structures", (await request("/api/grades", { method: "POST", token: tokens.TEACHER1, body: gradeBody })).status, 403, "teacher1 wrong subject");
  const gradeOk = await request("/api/grades", { method: "POST", token: tokens.TEACHER2, body: gradeBody });
  expectStatus("Test 3.3 teacher2 can grade Data Structures", gradeOk.status, [200, 201], gradeOk.body, gradeOk.durationMs);

  expectStatus("Test 3.4 student cannot view section analytics", (await request(`/api/analytics/section/${seeded.sectionE2.id}`, { token: tokens.STUDENT1 })).status, 403, "student section analytics");
  expectStatus("Test 3.4 coordinator can view section analytics", (await request(`/api/analytics/section/${seeded.sectionE2.id}`, { token: tokens.COORD })).status, 200, "coord section analytics");
  expectStatus("Test 3.5 student cannot view another student's grades", (await request(`/api/grades/student/${seeded.users.student2.id}`, { token: tokens.STUDENT1 })).status, 403, "cross grades");
  expectStatus("Test 3.5 student can view own grades", (await request(`/api/grades/student/${seeded.users.student1.id}`, { token: tokens.STUDENT1 })).status, 200, "own grades");

  const problemBody = (slug: string) => JSON.stringify({
    title: `QA Problem ${slug}`,
    slug,
    description: "A QA-created problem with enough text for validation.",
    difficulty: "EASY",
    tags: ["qa"],
    scope: "GLOBAL",
  });
  expectStatus("Test 3.6 student cannot create problem", (await request("/api/problems", { method: "POST", token: tokens.STUDENT1, body: problemBody(`student-${Date.now()}`) })).status, 403, "student problem create");
  const teacherProblem = await request("/api/problems", { method: "POST", token: tokens.TEACHER1, body: problemBody(`teacher-${Date.now()}`) });
  expectStatus("Test 3.6 teacher can create problem", teacherProblem.status, [200, 201], teacherProblem.body, teacherProblem.durationMs);
  const adminProblem = await request("/api/problems", { method: "POST", token: tokens.ADMIN, body: problemBody(`admin-${Date.now()}`) });
  expectStatus("Test 3.6 admin can create problem", adminProblem.status, [200, 201], adminProblem.body, adminProblem.durationMs);

  expectStatus("Test 3.7 student cannot view platform analytics", (await request("/api/analytics/platform", { token: tokens.STUDENT1 })).status, 403, "student platform analytics");
  expectStatus("Test 3.7 teacher cannot view platform analytics", (await request("/api/analytics/platform", { token: tokens.TEACHER1 })).status, 403, "teacher platform analytics");
  expectStatus("Test 3.7 admin can view platform analytics", (await request("/api/analytics/platform", { token: tokens.ADMIN })).status, 200, "admin platform analytics");

  // Phase 4 assignment and notifications.
  const assignment = await request("/api/assignments", {
    method: "POST",
    token: tokens.TEACHER1,
    body: JSON.stringify({
      title: `QA Linked List ${Date.now()}`,
      description: "Solve linked list practice questions for QA lifecycle testing.",
      subjectId: seeded.webTech.id,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxScore: 100,
    }),
  });
  expectStatus("Test 4.3 assignment creation", assignment.status, [200, 201], assignment.body, assignment.durationMs);
  const assignmentData = dataOf<{ id: string }>(assignment.body);
  if (assignmentData?.id) {
    expectStatus("Test 4.3 student can view assignment", (await request(`/api/assignments/${assignmentData.id}`, { token: tokens.STUDENT1 })).status, 200, "assignment visible");
    const submit = await request(`/api/assignments/${assignmentData.id}/submit`, { method: "POST", token: tokens.STUDENT1, body: JSON.stringify({ content: "My solution" }) });
    expectStatus("Test 4.3 student assignment submit", submit.status, [200, 201], submit.body, submit.durationMs);
    const notifications = await request("/api/notifications", { token: tokens.STUDENT1 });
    const hasAssignmentNotification = JSON.stringify(notifications.body).includes(assignmentData.id);
    record(hasAssignmentNotification ? "PASS" : "FAIL", "Test 10.1 assignment notification", hasAssignmentNotification ? "student notification includes assignment id" : `notification missing; body=${JSON.stringify(notifications.body).slice(0, 500)}`);
  }

  // Phase 5 Judge0 run/submit plus socket auth.
  const noAuthSocket = io(SOCKET_URL, { transports: ["websocket"], autoConnect: false, timeout: 5000 });
  const noAuthRejected = await new Promise<boolean>((resolve) => {
    noAuthSocket.once("connect", () => resolve(false));
    noAuthSocket.once("connect_error", () => resolve(true));
    noAuthSocket.connect();
    setTimeout(() => resolve(false), 6000);
  });
  noAuthSocket.disconnect();
  record(noAuthRejected ? "PASS" : "FAIL", "Test 16.1 unauthenticated socket rejected", noAuthRejected ? "connect_error received" : "socket connected or timed out unexpectedly");

  const authedSocket = io(SOCKET_URL, { transports: ["websocket"], auth: { token: tokens.STUDENT1 }, autoConnect: false });
  const socketConnected = await new Promise<boolean>((resolve) => {
    authedSocket.once("connect", () => resolve(true));
    authedSocket.once("connect_error", () => resolve(false));
    authedSocket.connect();
    setTimeout(() => resolve(false), 8000);
  });
  record(socketConnected ? "PASS" : "FAIL", "Test 16.2 authenticated socket accepted", socketConnected ? "connected successfully" : "connect_error/timeout");

  const run = await request(`/api/problems/${seeded.helloWorld.id}/run`, {
    method: "POST",
    token: tokens.STUDENT1,
    body: JSON.stringify({ language: "python", source_code: "print('Hello, World!')" }),
  });
  expectStatus("Test 5.2 run mode", run.status, 200, run.body, run.durationMs);

  let verdictEvent: unknown = null;
  const verdictPromise = new Promise<unknown>((resolve) => {
    authedSocket.once("verdict:ready", (payload) => {
      verdictEvent = payload;
      resolve(payload);
    });
  });
  const submitStarted = Date.now();
  const submit = await request(`/api/problems/${seeded.helloWorld.id}/submit`, {
    method: "POST",
    token: tokens.STUDENT1,
    body: JSON.stringify({ language: "python", source_code: "print('Hello, World!')" }),
  });
  expectStatus("Test 5.3 submit mode fast response", submit.status, [201, 202], submit.body, submit.durationMs);
  const submissionId = dataOf<{ submissionId: string }>(submit.body)?.submissionId;
  if (submissionId) {
    await Promise.race([verdictPromise, new Promise((resolve) => setTimeout(resolve, 45000))]);
    const final = await waitForSubmission(submissionId, tokens.STUDENT1!);
    const pipelineMs = Date.now() - submitStarted;
    record(final?.data.verdict === "AC" ? "PASS" : "FAIL", "Test 5.3 async verdict pipeline", `verdict=${final?.data.verdict ?? "timeout"}, socketEvent=${JSON.stringify(verdictEvent).slice(0, 300)}`, pipelineMs);
  }
  authedSocket.disconnect();

  const leaderboard = await request("/api/leaderboard/global", { token: tokens.STUDENT1 });
  expectStatus("Test 5.3 leaderboard after AC", leaderboard.status, 200, leaderboard.body, leaderboard.durationMs);

  // Phase 12 / 13 focused validation and rate checks.
  const invalidProblem = await request("/api/problems", { method: "POST", token: tokens.TEACHER1, body: JSON.stringify({ ...JSON.parse(problemBody(`bad-${Date.now()}`)), difficulty: "IMPOSSIBLE" }) });
  expectStatus("Test 13.4 invalid difficulty returns 400", invalidProblem.status, 400, invalidProblem.body, invalidProblem.durationMs);
  const badGrade = await request("/api/grades", { method: "POST", token: tokens.TEACHER2, body: JSON.stringify({ studentId: seeded.users.student1.id, subjectId: seeded.dataStructures.id, examType: "MID", marks: 101, maxMarks: 100, semester: 4 }) });
  expectStatus("Test 13.7 marks > maxMarks returns 400", badGrade.status, 400, badGrade.body, badGrade.durationMs);

  let rateLimited = false;
  for (let i = 0; i < 12; i += 1) {
    const r = await request(`/api/problems/${seeded.helloWorld.id}/submit`, {
      method: "POST",
      token: tokens.STUDENT1,
      body: JSON.stringify({ language: "python", source_code: "print('Hello, World!')" }),
    });
    if (r.status === 429) {
      rateLimited = true;
      break;
    }
  }
  record(rateLimited ? "PASS" : "FAIL", "Test 12.2 submission endpoint rate limit", rateLimited ? "429 returned within 12 rapid submissions" : "no 429 within 12 rapid submissions");

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    partial: results.filter((r) => r.status === "PARTIAL").length,
    failed: results.filter((r) => r.status === "FAIL"),
    slowestEndpoint: endpointTimings.sort((a, b) => b.ms - a.ms)[0] ?? null,
  };
  console.log("QA_SUMMARY", JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    record("FAIL", "Harness fatal error", error instanceof Error ? error.stack ?? error.message : String(error));
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
