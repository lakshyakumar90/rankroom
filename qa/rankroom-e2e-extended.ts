import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../packages/database/src/index";

loadEnv({ path: "packages/database/.env", override: false });
loadEnv({ path: "apps/api/.env", override: false });

const API = process.env.API_URL ?? "http://localhost:4000";
const PASSWORD = process.env.SEED_USER_PASSWORD || "RankRoomSeed#2026";
const results: Array<{ status: "PASS" | "FAIL" | "PARTIAL"; name: string; note: string; durationMs?: number }> = [];
const timings: Array<{ path: string; ms: number }> = [];

const users = {
  ADMIN: "admin@rankroom.dev",
  STUDENT1: "aarav.patel@rankroom.dev",
  STUDENT2: "diya.menon@rankroom.dev",
  STUDENT3: "vihaan.gupta@rankroom.dev",
  COORD: "arjun.rao@rankroom.dev",
  HOD: "meera.sharma@rankroom.dev",
} as const;

function record(status: "PASS" | "FAIL" | "PARTIAL", name: string, note: string, durationMs?: number) {
  results.push({ status, name, note, durationMs });
  console.log(`${status} — ${name} — ${note}${durationMs !== undefined ? ` (${durationMs}ms)` : ""}`);
}

async function token(email: string) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session?.access_token) throw new Error(`Login failed for ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function request(path: string, init: RequestInit & { token?: string } = {}) {
  const started = Date.now();
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  const ms = Date.now() - started;
  timings.push({ path, ms });
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, body, ms };
}

function data<T>(body: unknown): T | null {
  return body && typeof body === "object" ? ((body as { data?: T }).data ?? null) : null;
}

function expect(name: string, actual: number, expected: number | number[], body: unknown, ms?: number) {
  const list = Array.isArray(expected) ? expected : [expected];
  record(list.includes(actual) ? "PASS" : "FAIL", name, list.includes(actual) ? `HTTP ${actual} as expected` : `expected ${list.join("/")} got ${actual}; body=${JSON.stringify(body).slice(0, 500)}`, ms);
}

async function main() {
  const [adminToken, student1Token, student2Token, coordToken, hodToken] = await Promise.all([
    token(users.ADMIN),
    token(users.STUDENT1),
    token(users.STUDENT2),
    token(users.COORD),
    token(users.HOD),
  ]);
  const section = await prisma.section.findFirstOrThrow({ where: { code: "E2" } });
  const department = await prisma.department.findFirstOrThrow({ where: { code: "ENG" } });
  const problem = await prisma.problem.findFirstOrThrow({ where: { slug: "hello-world" } });
  const student1 = await prisma.user.findFirstOrThrow({ where: { email: users.STUDENT1 } });

  const now = Date.now();
  const contest = await request("/api/contests", {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({
      title: `QA Weekly Challenge ${now}`,
      description: "QA-created contest for registration and standings checks.",
      startTime: new Date(now + 2 * 60 * 1000).toISOString(),
      endTime: new Date(now + 62 * 60 * 1000).toISOString(),
      registrationEnd: new Date(now + 60 * 1000).toISOString(),
      type: "PUBLIC",
      scope: "GLOBAL",
      problemIds: [problem.id],
      participantIds: [],
    }),
  });
  expect("Phase 6.1 contest creation", contest.status, [200, 201], contest.body, contest.ms);
  const contestId = data<{ id: string }>(contest.body)?.id;
  if (contestId) {
    expect("Phase 6.1 student contest registration", (await request(`/api/contests/${contestId}/register`, { method: "POST", token: student1Token })).status, [200, 201], "register");
    expect("Phase 6.1 duplicate contest registration rejected", (await request(`/api/contests/${contestId}/register`, { method: "POST", token: student1Token })).status, [400, 409], "duplicate");
    expect("Phase 6.2 contest standings readable", (await request(`/api/contests/${contestId}/standings`, { token: student1Token })).status, 200, "standings");
    expect("Phase 6.2 prompt publish route /publish", (await request(`/api/contests/${contestId}/publish`, { method: "POST", token: adminToken })).status, 200, "publish");
    expect("Phase 6.2 actual publish-results route", (await request(`/api/contests/${contestId}/publish-results`, { method: "POST", token: adminToken })).status, [200, 400], "publish-results");
  }

  const hackathon = await request("/api/hackathons", {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({
      title: `QA Build Sprint ${now}`,
      description: "QA-created hackathon for registration checks.",
      departmentId: department.id,
      minSkills: [],
      minProjects: 0,
      minLeetcode: 0,
      minCgpa: null,
      startDate: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      registrationDeadline: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      maxTeamSize: 3,
      minTeamSize: 1,
      status: "REGISTRATION_OPEN",
    }),
  });
  expect("Phase 7.1 hackathon creation", hackathon.status, [200, 201], hackathon.body, hackathon.ms);
  const hackathonId = data<{ id: string }>(hackathon.body)?.id;
  if (hackathonId) {
    expect("Phase 7.1 student hackathon registration", (await request(`/api/hackathons/${hackathonId}/register`, { method: "POST", token: student1Token })).status, [200, 201], "hackathon register");
    expect("Phase 7.1 prompt team route", (await request(`/api/hackathons/${hackathonId}/teams`, { method: "POST", token: student1Token, body: JSON.stringify({ name: "Team Alpha" }) })).status, 201, "team create");
    expect("Phase 7.1 disabled event-team route returns 410", (await request(`/api/hackathons/${hackathonId}/event-teams`, { method: "POST", token: student1Token, body: JSON.stringify({ body: { name: "Team Alpha" } }) })).status, 410, "event teams disabled");
  }

  expect("Phase 8.1 global leaderboard", (await request("/api/leaderboard/global", { token: student1Token })).status, 200, "global leaderboard");
  expect("Phase 8.2 section leaderboard", (await request(`/api/leaderboard/section/${section.id}`, { token: student1Token })).status, 200, "section leaderboard");
  expect("Phase 9.1 coordinator at-risk endpoint", (await request(`/api/analytics/section/${section.id}/at-risk`, { token: coordToken })).status, 200, "coord at-risk");
  expect("Phase 9.1 student section analytics forbidden", (await request(`/api/analytics/section/${section.id}`, { token: student1Token })).status, 403, "student analytics forbidden");

  const notifications = await request("/api/notifications", { token: student1Token });
  expect("Phase 10.1 notification list", notifications.status, 200, notifications.body, notifications.ms);
  const firstNotification = Array.isArray(data<unknown[]>(notifications.body)) ? data<Array<{ id: string }>>(notifications.body)?.[0] : null;
  if (firstNotification?.id) {
    expect("Phase 10.2 mark notification read", (await request(`/api/notifications/${firstNotification.id}/read`, { method: "PATCH", token: student1Token })).status, 200, "mark read");
    expect("Phase 10.3 mark all notifications read", (await request("/api/notifications/read-all", { method: "PATCH", token: student1Token })).status, 200, "mark all read");
  }
  expect("Phase 10.4 prompt broadcast route /api/notifications", (await request("/api/notifications", { method: "POST", token: adminToken, body: JSON.stringify({ title: "System Maintenance", scope: "PLATFORM", message: "QA broadcast" }) })).status, 201, "prompt broadcast route");
  expect("Phase 10.4 actual broadcast route /api/notifications/send", (await request("/api/notifications/send", { method: "POST", token: adminToken, body: JSON.stringify({ type: "GENERAL", title: "System Maintenance", message: "QA broadcast" }) })).status, [200, 201], "actual broadcast route");

  expect("Phase 11.1 prompt profile update route", (await request(`/api/users/${student1.id}/profile`, { method: "PATCH", token: student1Token, body: JSON.stringify({ githubUsername: "someuser", leetcodeUsername: "someuser" }) })).status, 200, "prompt profile patch");
  expect("Phase 11.1 actual profile update route", (await request("/api/profile/update", { method: "PATCH", token: student1Token, body: JSON.stringify({ githubUsername: "someuser", leetcodeUsername: "someuser" }) })).status, [200, 400], "actual profile patch");

  console.log("QA_EXTENDED_SUMMARY", JSON.stringify({
    total: results.length,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    partial: results.filter((r) => r.status === "PARTIAL").length,
    failed: results.filter((r) => r.status === "FAIL"),
    slowestEndpoint: timings.sort((a, b) => b.ms - a.ms)[0] ?? null,
  }, null, 2));
}

main()
  .catch((error) => record("FAIL", "Extended harness fatal error", error instanceof Error ? error.stack ?? error.message : String(error)))
  .finally(async () => {
    await prisma.$disconnect();
  });
