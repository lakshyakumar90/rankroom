import { SUPPORTED_LANGUAGES } from "@repo/types";

const JUDGE0_URL = process.env["JUDGE0_API_URL"] ?? "https://judge0-ce.p.rapidapi.com";
const JUDGE0_KEY = process.env["JUDGE0_API_KEY"] ?? "";

interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
}

interface Judge0Result {
  token: string;
  status: { id: number; description: string };
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string;
  memory?: number;
}

const headers = {
  "Content-Type": "application/json",
  ...(JUDGE0_KEY ? { "X-RapidAPI-Key": JUDGE0_KEY, "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com" } : {}),
};

function getLanguageId(language: string): number {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.id === language);
  return lang?.judge0Id ?? 71; // default to Python 3
}

// Map Judge0 status id to our SubmissionStatus
export function mapJudge0Status(statusId: number): string {
  switch (statusId) {
    case 3: return "ACCEPTED";
    case 4: return "WRONG_ANSWER";
    case 5: return "TIME_LIMIT_EXCEEDED";
    case 6: return "COMPILATION_ERROR";
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12: return "RUNTIME_ERROR";
    case 13: return "MEMORY_LIMIT_EXCEEDED";
    default: return "WRONG_ANSWER";
  }
}

// Submit a single test case and get the token
export async function submitToJudge0(params: {
  code: string;
  language: string;
  input: string;
  expectedOutput?: string;
}): Promise<string> {
  const body: Judge0Submission = {
    source_code: Buffer.from(params.code).toString("base64"),
    language_id: getLanguageId(params.language),
    stdin: Buffer.from(params.input).toString("base64"),
    ...(params.expectedOutput ? { expected_output: Buffer.from(params.expectedOutput).toString("base64") } : {}),
  };

  const res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Judge0 submission failed: ${res.status}`);
  const data = await res.json() as { token: string };
  return data.token;
}

// Submit multiple test cases in batch
export async function submitBatchToJudge0(submissions: { code: string; language: string; input: string; expectedOutput?: string }[]): Promise<string[]> {
  const body = {
    submissions: submissions.map((s) => ({
      source_code: Buffer.from(s.code).toString("base64"),
      language_id: getLanguageId(s.language),
      stdin: Buffer.from(s.input).toString("base64"),
      ...(s.expectedOutput ? { expected_output: Buffer.from(s.expectedOutput).toString("base64") } : {}),
    })),
  };

  const res = await fetch(`${JUDGE0_URL}/submissions/batch?base64_encoded=true`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Judge0 batch submission failed: ${res.status}`);
  const data = await res.json() as { token: string }[];
  return data.map((d) => d.token);
}

// Poll for result with retries
export async function getJudge0Result(token: string, maxRetries = 10): Promise<Judge0Result> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=true`, { headers });
    if (!res.ok) throw new Error(`Judge0 poll failed: ${res.status}`);

    const data = await res.json() as Judge0Result;

    // Status 1 = In Queue, 2 = Processing
    if (data.status.id > 2) return data;

    // Wait before retry (exponential backoff)
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }

  throw new Error("Judge0 timed out waiting for result");
}

// Get multiple results
export async function getBatchJudge0Results(tokens: string[]): Promise<Judge0Result[]> {
  const res = await fetch(
    `${JUDGE0_URL}/submissions/batch?tokens=${tokens.join(",")}&base64_encoded=true`,
    { headers }
  );
  if (!res.ok) throw new Error(`Judge0 batch poll failed: ${res.status}`);
  const data = await res.json() as { submissions: Judge0Result[] };
  return data.submissions;
}

// Run code against a single custom input (for "Run" button)
export async function runCode(params: {
  code: string;
  language: string;
  input: string;
}): Promise<{ stdout: string; stderr: string; status: string; runtime?: number; memory?: number }> {
  const token = await submitToJudge0({ ...params });

  // Poll for result
  const result = await getJudge0Result(token);

  const decode = (s?: string) => (s ? Buffer.from(s, "base64").toString("utf-8") : "");

  return {
    stdout: decode(result.stdout),
    stderr: decode(result.stderr) || decode(result.compile_output),
    status: result.status.description,
    runtime: result.time ? Math.round(parseFloat(result.time) * 1000) : undefined,
    memory: result.memory,
  };
}
