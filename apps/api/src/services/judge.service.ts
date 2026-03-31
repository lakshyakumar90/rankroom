import { JUDGE0_TIMEOUT_MS, JUDGE0_URL } from "../config/judge0";
import type { TestResult, Verdict } from "@repo/types";

const JUDGE0_API_KEY = process.env["JUDGE0_API_KEY"] ?? "";
const JUDGE0_IS_RAPID_API = JUDGE0_URL.includes("rapidapi.com");

export const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
  go: 60,
  rust: 73,
};

export interface Judge0Result {
  status: { id: number; description: string };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
  token?: string;
}

function encode(value?: string | null) {
  return Buffer.from(value ?? "", "utf8").toString("base64");
}

function decode(value?: string | null) {
  if (!value) return null;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return value;
  }
}

async function judgeFetch(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JUDGE0_TIMEOUT_MS);
  const headers = new Headers(init?.headers);

  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  if (JUDGE0_API_KEY) {
    if (JUDGE0_IS_RAPID_API) {
      headers.set("X-RapidAPI-Key", JUDGE0_API_KEY);
      headers.set("X-RapidAPI-Host", "judge0-ce.p.rapidapi.com");
    } else {
      headers.set("X-Auth-Token", JUDGE0_API_KEY);
    }
  }

  try {
    const response = await fetch(`${JUDGE0_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Judge0 request failed at ${JUDGE0_URL}. ${detail}`);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeJudgeResult(result: Judge0Result): Judge0Result {
  return {
    ...result,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
    compile_output: decode(result.compile_output),
  };
}

export function mapVerdict(statusId: number): Verdict {
  switch (statusId) {
    case 1:
    case 2:
      return "JUDGING";
    case 3:
      return "AC";
    case 4:
      return "WA";
    case 5:
      return "TLE";
    case 6:
      return "CE";
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 14:
      return "RE";
    case 13:
      return "MLE";
    default:
      return "RE";
  }
}

export async function submitToJudge0(source_code: string, language_id: number, stdin: string, expected_output?: string) {
  const response = await judgeFetch("/submissions?base64_encoded=true&wait=false", {
    method: "POST",
    body: JSON.stringify({
      source_code: encode(source_code),
      language_id,
      stdin: encode(stdin),
      ...(expected_output !== undefined ? { expected_output: encode(expected_output) } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Judge0 submit failed: ${response.status}`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

export async function pollResult(token: string): Promise<Judge0Result> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await judgeFetch(`/submissions/${token}?base64_encoded=true`);
    if (!response.ok) {
      throw new Error(`Judge0 poll failed: ${response.status}`);
    }

    const result = normalizeJudgeResult((await response.json()) as Judge0Result);
    if (result.status.id > 2) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Judge0 polling timed out");
}

export async function runBatch(
  source_code: string,
  language_id: number,
  testCases: { input: string; expected_output: string }[]
): Promise<Judge0Result[]> {
  const response = await judgeFetch("/submissions/batch?base64_encoded=true", {
    method: "POST",
    body: JSON.stringify({
      submissions: testCases.map((testCase) => ({
        source_code: encode(source_code),
        language_id,
        stdin: encode(testCase.input),
        expected_output: encode(testCase.expected_output),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Judge0 batch submit failed: ${response.status}`);
  }

  const submissions = (await response.json()) as { token: string }[];
  const tokens = submissions.map((submission) => submission.token);

  for (let attempt = 0; attempt < 10; attempt++) {
    const batchResponse = await judgeFetch(`/submissions/batch?tokens=${tokens.join(",")}&base64_encoded=true`);
    if (!batchResponse.ok) {
      throw new Error(`Judge0 batch poll failed: ${batchResponse.status}`);
    }

    const batch = (await batchResponse.json()) as { submissions: Judge0Result[] };
    const normalized = batch.submissions.map(normalizeJudgeResult);
    if (normalized.every((submission) => submission.status.id > 2)) {
      return normalized;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Judge0 batch polling timed out");
}

export function toTestResult(result: Judge0Result, caseIndex: number, expected: string | null): TestResult {
  const verdict = mapVerdict(result.status.id);
  return {
    caseIndex,
    verdict,
    stdout: result.stdout,
    expected,
    stderr: result.stderr,
    compileOutput: result.compile_output,
    runtime: result.time ? Math.round(parseFloat(result.time) * 1000) : null,
    memory: result.memory ?? null,
    passed: verdict === "AC",
  };
}
