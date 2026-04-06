import {
  JUDGE0_CPU_TIME_LIMIT,
  JUDGE0_MAX_MEMORY_LIMIT,
  JUDGE0_MEMORY_LIMIT,
  JUDGE0_MAX_CPU_TIME_LIMIT,
  JUDGE0_MAX_WALL_TIME_LIMIT,
  JUDGE0_POLL_INITIAL_DELAY_MS,
  JUDGE0_POLL_MAX_ATTEMPTS,
  JUDGE0_POLL_MAX_DELAY_MS,
  JUDGE0_REQUEST_RETRIES,
  JUDGE0_TIMEOUT_MS,
  JUDGE0_URL,
  JUDGE0_WALL_TIME_LIMIT,
} from "../config/judge0";
import type { TestResult, Verdict } from "@repo/types";
import { logger } from "../lib/logger";
import { FALLBACK_JUDGE0_LANGUAGE_IDS } from "../lib/judge0-languages";
import {
  byteLengthUtf8,
  getExecutionConfig,
  MAX_SOURCE_CODE_BYTES,
  MAX_STDIN_BYTES,
  MAX_TEST_CASES_PER_SUBMIT,
  truncateUtf8,
} from "../config/execution";
import { wrapSourceCode } from "../config/templates";
import { createHash } from "crypto";
import { acquireJudge0Token } from "../lib/judge0-rate-limiter";

const JUDGE0_API_KEY = process.env["JUDGE0_API_KEY"] ?? "";
const JUDGE0_IS_RAPID_API = JUDGE0_URL.includes("rapidapi.com");
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 15_000;
let consecutiveJudge0Failures = 0;
let circuitOpenUntil = 0;

export const LANGUAGE_IDS: Record<string, number> = { ...FALLBACK_JUDGE0_LANGUAGE_IDS };

export interface Judge0Result {
  status: { id: number; description: string };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
  cpu_time_limit?: number | null;
  wall_time_limit?: number | null;
  memory_limit?: number | null;
  token?: string;
}

interface CreateSubmissionInput {
  source_code: string;
  language_id: number;
  stdin?: string | null;
  expected_output?: string;
  cpu_time_limit?: number;
  wall_time_limit?: number;
  memory_limit?: number;
  compiler_options?: string;
  idempotencyKey?: string;
}

interface Judge0SubmissionPayload {
  source_code: string;
  language_id: number;
  stdin: string;
  expected_output?: string;
  cpu_time_limit: number;
  wall_time_limit: number;
  memory_limit: number;
  stack_limit?: number;
  enable_per_process_and_thread_time_limit?: boolean;
  enable_per_process_and_thread_memory_limit?: boolean;
  compiler_options?: string;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientJudge0Failure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /AbortError|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(error.message);
}

function assertValidSubmissionInput(input: CreateSubmissionInput) {
  if (!input.source_code || typeof input.source_code !== "string") {
    throw new Error("Judge0 validation failed: source_code is required");
  }

  if (!Number.isInteger(input.language_id)) {
    throw new Error("Judge0 validation failed: language_id must be an integer");
  }

  if (input.language_id <= 0) {
    throw new Error("Judge0 validation failed: language_id must be positive");
  }

  if (byteLengthUtf8(input.source_code) > MAX_SOURCE_CODE_BYTES) {
    throw new Error(`Judge0 validation failed: source_code exceeds ${MAX_SOURCE_CODE_BYTES} bytes`);
  }

  if (byteLengthUtf8(input.stdin) > MAX_STDIN_BYTES) {
    throw new Error(`Judge0 validation failed: stdin exceeds ${MAX_STDIN_BYTES} bytes`);
  }
}



function buildSubmissionPayload(input: CreateSubmissionInput): Judge0SubmissionPayload {
  assertValidSubmissionInput(input);

  const langConfig = getExecutionConfig(input.language_id);
  const normalizedStdin = input.stdin ?? "";
  const compiler_options = input.compiler_options ?? langConfig.compiler_options;
  const wrappedCode = wrapSourceCode(input.language_id, input.source_code);

  const requestedCpu = input.cpu_time_limit ?? langConfig.cpu_time_limit ?? JUDGE0_CPU_TIME_LIMIT;
  const requestedWall = input.wall_time_limit ?? langConfig.wall_time_limit ?? JUDGE0_WALL_TIME_LIMIT;
  const requestedMemory = input.memory_limit ?? langConfig.memory_limit ?? JUDGE0_MEMORY_LIMIT;
  const enable_per_process_and_thread_time_limit =
    langConfig.enable_per_process_and_thread_time_limit ?? true;
  const enable_per_process_and_thread_memory_limit =
    langConfig.enable_per_process_and_thread_memory_limit ?? true;
  const cpu_time_limit = Math.min(requestedCpu, JUDGE0_MAX_CPU_TIME_LIMIT);
  // Ensure wall >= cpu, and never exceed CE caps (prevents 422).
  const wall_time_limit = Math.min(Math.max(requestedWall, cpu_time_limit), JUDGE0_MAX_WALL_TIME_LIMIT);
  const memory_limit = Math.min(requestedMemory, JUDGE0_MAX_MEMORY_LIMIT);

  return {
    source_code: encode(wrappedCode),
    language_id: input.language_id,
    stdin: encode(normalizedStdin),
    ...(input.expected_output !== undefined ? { expected_output: encode(input.expected_output) } : {}),
    ...(compiler_options ? { compiler_options } : {}),
    cpu_time_limit,
    wall_time_limit,
    memory_limit,
    ...(langConfig.stack_limit ? { stack_limit: langConfig.stack_limit } : {}),
    enable_per_process_and_thread_time_limit,
    enable_per_process_and_thread_memory_limit,
  };
}

function logSubmissionPayload(payload: Judge0SubmissionPayload, context: { expectedOutput: boolean }) {
  logger.info(
    {
      language_id: payload.language_id,
      hasStdin: payload.stdin.length > 0,
      hasExpectedOutput: context.expectedOutput,
      cpu_time_limit: payload.cpu_time_limit,
      wall_time_limit: payload.wall_time_limit,
      memory_limit: payload.memory_limit,
      compiler_options: payload.compiler_options ?? "none",
      sourceCodeBytes: payload.source_code.length,
    },
    "Submitting payload to Judge0"
  );
}

async function judgeFetch(path: string, init?: RequestInit, retries = JUDGE0_REQUEST_RETRIES) {
  if (Date.now() < circuitOpenUntil) {
    throw new Error("Judge0 circuit is open. Requests are temporarily paused.");
  }

  const maxRetries = Math.max(0, retries);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
      await acquireJudge0Token();

      const response = await fetch(`${JUDGE0_URL}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const canRetry = response.status >= 500 && attempt < maxRetries;
      if (canRetry) {
        consecutiveJudge0Failures += 1;
        if (consecutiveJudge0Failures >= CIRCUIT_BREAKER_THRESHOLD) {
          circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        }

        const delay = Math.min(400 * 2 ** attempt, 4000);
        logger.warn({ path, status: response.status, attempt: attempt + 1, delayMs: delay }, "Retrying Judge0 request");
        await sleep(delay);
        continue;
      }

      consecutiveJudge0Failures = 0;

      return response;
    } catch (error) {
      const shouldRetry = isTransientJudge0Failure(error) && attempt < maxRetries;
      if (shouldRetry) {
        consecutiveJudge0Failures += 1;
        if (consecutiveJudge0Failures >= CIRCUIT_BREAKER_THRESHOLD) {
          circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        }

        const delay = Math.min(300 * (attempt + 1), 1000);
        logger.warn({ path, attempt: attempt + 1, error }, "Transient Judge0 failure, retrying");
        await sleep(delay);
        continue;
      }

      consecutiveJudge0Failures += 1;
      if (consecutiveJudge0Failures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      }

      const detail = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Judge0 request failed at ${JUDGE0_URL}. ${detail}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Judge0 request failed after retries");
}

function normalizeJudgeResult(result: Judge0Result): Judge0Result {
  return {
    ...result,
    stdout: truncateUtf8(decode(result.stdout)),
    stderr: truncateUtf8(decode(result.stderr)),
    compile_output: truncateUtf8(decode(result.compile_output)),
  };
}

const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotentSubmissionTokens = new Map<string, { token: string; expiresAt: number }>();

function computeSubmissionIdempotencyKey(input: CreateSubmissionInput): string {
  const hash = createHash("sha256");
  hash.update(input.source_code);
  hash.update("|");
  hash.update(String(input.language_id));
  hash.update("|");
  hash.update(input.stdin ?? "");
  hash.update("|");
  hash.update(input.expected_output ?? "");
  hash.update("|");
  hash.update(String(input.cpu_time_limit ?? ""));
  hash.update("|");
  hash.update(String(input.wall_time_limit ?? ""));
  hash.update("|");
  hash.update(String(input.memory_limit ?? ""));
  return hash.digest("hex");
}

function getIdempotentToken(idempotencyKey: string): string | null {
  const entry = idempotentSubmissionTokens.get(idempotencyKey);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    idempotentSubmissionTokens.delete(idempotencyKey);
    return null;
  }
  return entry.token;
}

function setIdempotentToken(idempotencyKey: string, token: string) {
  idempotentSubmissionTokens.set(idempotencyKey, {
    token,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
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

export async function submitToJudge0(
  source_code: string,
  language_id: number,
  stdin: string,
  expected_output?: string
) {
  return createSubmission({
    source_code,
    language_id,
    stdin,
    expected_output,
  });
}

export async function createSubmission(input: CreateSubmissionInput): Promise<string> {
  const idempotencyKey = input.idempotencyKey;
  if (idempotencyKey) {
    const existingToken = getIdempotentToken(idempotencyKey);
    if (existingToken) {
      logger.info({ idempotencyKey, token: existingToken }, "Reusing cached Judge0 submission token");
      return existingToken;
    }
  }

  const payload = buildSubmissionPayload(input);
  logSubmissionPayload(payload, { expectedOutput: input.expected_output !== undefined });

  const response = await judgeFetch("/submissions?base64_encoded=true&wait=false", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const hint =
      response.status === 503
        ? " (Judge0 returned 503 — service overloaded, restarting, or workers unavailable; check your Judge0 instance / Docker logs.)"
        : "";
    throw new Error(`Judge0 submit failed: ${response.status} ${body}${hint}`);
  }

  const data = (await response.json()) as { token: string };
  logger.info(
    {
      token: data.token,
      language_id: payload.language_id,
      cpu_time_limit: payload.cpu_time_limit,
      wall_time_limit: payload.wall_time_limit,
      memory_limit: payload.memory_limit,
    },
    "Judge0 submission accepted"
  );
  if (idempotencyKey) {
    setIdempotentToken(idempotencyKey, data.token);
  }
  return data.token;
}

// Sentinel result returned when our polling exhausts retries (not a Judge0 hard TLE).
const POLLING_TIMEOUT_RESULT: Judge0Result = {
  status: { id: 5, description: "Time Limit Exceeded" },
  stdout: null,
  stderr: "Execution timed out while waiting for Judge0 to respond. Try again.",
  compile_output: null,
  time: null,
  memory: null,
};

export async function pollResult(token: string): Promise<Judge0Result> {
  for (let attempt = 0; attempt < JUDGE0_POLL_MAX_ATTEMPTS; attempt++) {
    const response = await judgeFetch(`/submissions/${token}?base64_encoded=true`);
    if (!response.ok) {
      throw new Error(`Judge0 poll failed: ${response.status}`);
    }

    const result = normalizeJudgeResult((await response.json()) as Judge0Result);
    logger.info(
      {
        token,
        statusId: result.status.id,
        status: result.status.description,
        time: result.time,
        memory: result.memory,
        cpu_time_limit: result.cpu_time_limit ?? null,
        wall_time_limit: result.wall_time_limit ?? null,
        memory_limit: result.memory_limit ?? null,
      },
      "Judge0 poll result"
    );

    // status.id > 2 means the submission has finished (not In Queue=1, not Processing=2)
    if (result.status.id > 2) {
      return result;
    }

    // Progressive backoff with configurable upper bound.
    const delay = Math.min(JUDGE0_POLL_INITIAL_DELAY_MS + attempt * 250, JUDGE0_POLL_MAX_DELAY_MS);
    await sleep(delay);
  }

  return POLLING_TIMEOUT_RESULT;
}

export async function runBatch(
  source_code: string,
  language_id: number,
  testCases: { input: string; expected_output?: string }[],
  limits?: {
    cpu_time_limit?: number;
    wall_time_limit?: number;
    memory_limit?: number;
    compiler_options?: string;
  }
): Promise<Judge0Result[]> {
  if (testCases.length === 0) return [];
  if (testCases.length > MAX_TEST_CASES_PER_SUBMIT) {
    throw new Error(`Judge0 batch size exceeds ${MAX_TEST_CASES_PER_SUBMIT} test cases`);
  }

  const batchPayloadSubmissions = testCases.map((testCase) =>
    buildSubmissionPayload({
      source_code,
      language_id,
      stdin: testCase.input,
      expected_output: testCase.expected_output,
      cpu_time_limit: limits?.cpu_time_limit,
      wall_time_limit: limits?.wall_time_limit,
      memory_limit: limits?.memory_limit,
      compiler_options: limits?.compiler_options,
    })
  );

  logger.info(
    {
      totalSubmissions: batchPayloadSubmissions.length,
      language_id,
      cpu_time_limit: JUDGE0_CPU_TIME_LIMIT,
      wall_time_limit: JUDGE0_WALL_TIME_LIMIT,
      memory_limit: JUDGE0_MEMORY_LIMIT,
    },
    "Submitting Judge0 batch payload"
  );

  const response = await judgeFetch("/submissions/batch?base64_encoded=true", {
    method: "POST",
    body: JSON.stringify({
      submissions: batchPayloadSubmissions,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Judge0 batch submit failed: ${response.status} ${errorBody}`);
  }

  const submissions = (await response.json()) as { token: string }[];
  const tokens = submissions.map((submission) => submission.token);

  // Seed with sentinel so we always have something to return on timeout
  let lastNormalized: Judge0Result[] = tokens.map(() => POLLING_TIMEOUT_RESULT);

  for (let attempt = 0; attempt < JUDGE0_POLL_MAX_ATTEMPTS; attempt++) {
    const batchResponse = await judgeFetch(
      `/submissions/batch?tokens=${tokens.join(",")}&base64_encoded=true`
    );
    if (!batchResponse.ok) {
      throw new Error(`Judge0 batch poll failed: ${batchResponse.status}`);
    }

    const batch = (await batchResponse.json()) as { submissions: Judge0Result[] };
    lastNormalized = batch.submissions.map(normalizeJudgeResult);

    logger.info(
      {
        tokens: tokens.length,
        completed: lastNormalized.filter((submission) => submission.status.id > 2).length,
      },
      "Judge0 batch poll progress"
    );

    // All done when every submission has a terminal status (id > 2)
    if (lastNormalized.every((s) => s.status.id > 2)) {
      return lastNormalized;
    }

    const delay = Math.min(JUDGE0_POLL_INITIAL_DELAY_MS + attempt * 250, JUDGE0_POLL_MAX_DELAY_MS);
    await sleep(delay);
  }

  // Return whatever we have; still-pending ones become POLLING_TIMEOUT_RESULT
  return lastNormalized.map((result) =>
    result.status.id <= 2 ? POLLING_TIMEOUT_RESULT : result
  );
}

export function toTestResult(
  result: Judge0Result,
  caseIndex: number,
  expected: string | null
): TestResult {
  const verdict = mapVerdict(result.status.id);
  return {
    caseIndex,
    verdict,
    stdout: truncateUtf8(result.stdout),
    expected,
    stderr: truncateUtf8(result.stderr),
    compileOutput: truncateUtf8(result.compile_output),
    runtime: result.time ? Math.round(parseFloat(result.time) * 1000) : null,
    memory: result.memory ?? null,
    passed: verdict === "AC",
    judgeStatusId: result.status.id,
    judgeStatusDescription: result.status.description,
  };
}
