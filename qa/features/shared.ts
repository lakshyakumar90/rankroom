import { config as loadEnv } from "dotenv";
import { io, type Socket } from "socket.io-client";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: join(repoRoot, "packages/database/.env"), override: false });
loadEnv({ path: join(repoRoot, "apps/api/.env"), override: false });

type PrismaClient = typeof import("../../packages/database/src/index")["prisma"];
let prismaCache: PrismaClient | null = null;

async function getPrisma() {
  prismaCache ??= (await import("../../packages/database/src/index")).prisma;
  return prismaCache;
}

export const API = process.env.API_URL ?? "http://localhost:4000";
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? API;
export const PASSWORD = process.env.SEED_USER_PASSWORD || "RankRoomSeed#2026";

export const emails = {
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

export type TokenKey = keyof typeof emails;

export type TestResult = {
  status: "PASS" | "FAIL";
  name: string;
  note: string;
  durationMs?: number;
};

export type TestContext = {
  tokens: Record<TokenKey, string>;
  users: Awaited<ReturnType<typeof loadSeedIds>>["users"];
  sectionE2: Awaited<ReturnType<typeof loadSeedIds>>["sectionE2"];
  sectionE3: Awaited<ReturnType<typeof loadSeedIds>>["sectionE3"];
  engineering: Awaited<ReturnType<typeof loadSeedIds>>["engineering"];
  dataStructures: Awaited<ReturnType<typeof loadSeedIds>>["dataStructures"];
  webTech: Awaited<ReturnType<typeof loadSeedIds>>["webTech"];
  helloWorld: Awaited<ReturnType<typeof loadSeedIds>>["helloWorld"];
  now: number;
};

export async function request(path: string, init: RequestInit & { token?: string } = {}) {
  const started = Date.now();
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, body, durationMs: Date.now() - started };
}

export function dataOf<T>(body: unknown): T | null {
  return body && typeof body === "object" ? ((body as { data?: T }).data ?? null) : null;
}

export function expectStatus(results: TestResult[], name: string, actual: number, expected: number | number[], body: unknown, durationMs?: number) {
  const expectedList = Array.isArray(expected) ? expected : [expected];
  const passed = expectedList.includes(actual);
  results.push({
    status: passed ? "PASS" : "FAIL",
    name,
    note: passed ? `HTTP ${actual} as expected` : `expected ${expectedList.join("/")} but got ${actual}; body=${JSON.stringify(body).slice(0, 500)}`,
    durationMs,
  });
}

export async function loginAll(results: TestResult[]) {
  const tokens = {} as Record<TokenKey, string>;
  for (const [key, email] of Object.entries(emails) as Array<[TokenKey, string]>) {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expectStatus(results, `auth login ${key}`, response.status, 200, response.body, response.durationMs);
    const accessToken =
      typeof response.body === "object" && response.body
        ? ((response.body as { accessToken?: string; data?: { accessToken?: string } }).accessToken ?? (response.body as { data?: { accessToken?: string } }).data?.accessToken)
        : undefined;
    if (!accessToken) throw new Error(`No access token returned for ${email}`);
    tokens[key] = accessToken;
  }
  return tokens;
}

export async function loadSeedIds() {
  const prisma = await getPrisma();
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  const byEmail = new Map(users.map((user) => [user.email, user]));
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
    engineering: await prisma.department.findFirstOrThrow({ where: { code: "ENG" } }),
    sectionE2: await prisma.section.findFirstOrThrow({ where: { code: "E2" } }),
    sectionE3: await prisma.section.findFirstOrThrow({ where: { code: "E3" } }),
    dataStructures: await prisma.subject.findFirstOrThrow({ where: { code: "DS402" } }),
    webTech: await prisma.subject.findFirstOrThrow({ where: { code: "WT401" } }),
    helloWorld: await prisma.problem.findFirstOrThrow({ where: { slug: "hello-world" } }),
  };
}

export async function ensureParticipationReady(ctx: TestContext, results: TestResult[]) {
  for (const [tokenKey, user] of [
    ["STUDENT1", ctx.users.student1],
    ["STUDENT2", ctx.users.student2],
    ["STUDENT3", ctx.users.student3],
  ] as const) {
    const response = await request(`/api/users/${user.id}/profile`, {
      method: "PATCH",
      token: ctx.tokens[tokenKey],
      body: JSON.stringify({
        phoneNumber: "+15550001000",
        avatar: `https://api.dicebear.com/8.x/initials/svg?seed=${user.id}`,
        isPublic: true,
      }),
    });
    expectStatus(results, `profile readiness ${tokenKey}`, response.status, 200, response.body, response.durationMs);
  }
}

export function authedSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

export async function disconnectPrisma() {
  if (prismaCache) await prismaCache.$disconnect();
}
