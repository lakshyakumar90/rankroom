import { logger } from "../lib/logger";
import { compareOutput, type CompareMode } from "./comparator.service";
import { runBatch } from "./judge.service";
import { serializeInput, type ParameterTypeDef } from "./input-serializer.service";
import { generateWrappedCode, type WrapperLanguage } from "./wrapper.service";
import { getJudge0LanguageId } from "../lib/judge0-languages";
import { computeExecutionLimits, TS_EXECUTION_MODE } from "../config/execution";
import ts from "typescript";

export interface ExecutionCaseResult {
  caseIndex: number;
  passed: boolean;
  verdict: "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "IE";
  stdout: string | null;
  expected: string;
  stderr: string | null;
  compileOutput: string | null;
  runtime: number;
  memory: number;
}

export interface ExecutionSummary {
  overallVerdict: string;
  passedCount: number;
  totalCount: number;
  results: ExecutionCaseResult[];
  maxRuntime: number;
  maxMemory: number;
}

export interface ExecutionProblemConfig {
  id: string;
  functionName: string | null;
  parameterTypes: unknown;
  returnType: string | null;
  compareMode: CompareMode;
  timeLimitMs: number;
  memoryLimitKb: number;
}

export interface ExecutionTestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface NormalizedExecutionSource {
  effectiveLanguage: string;
  effectiveUserCode: string;
  transpiledFromTypeScript: boolean;
}

function parseParameterTypes(raw: unknown): ParameterTypeDef[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const name = (entry as { name?: unknown }).name;
      const type = (entry as { type?: unknown }).type;
      if (typeof name !== "string" || typeof type !== "string") return null;
      return { name, type } as ParameterTypeDef;
    })
    .filter((entry): entry is ParameterTypeDef => entry !== null);
}

export function normalizeExecutionSource(language: string, userCode: string): NormalizedExecutionSource {
  const shouldTranspileTypeScript = language === "typescript" && TS_EXECUTION_MODE === "transpile";
  const effectiveLanguage = shouldTranspileTypeScript ? "javascript" : language;
  const effectiveUserCode = shouldTranspileTypeScript
    ? ts.transpileModule(userCode, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          strict: false,
          esModuleInterop: true,
          removeComments: false,
        },
      }).outputText
    : userCode;

  return {
    effectiveLanguage,
    effectiveUserCode,
    transpiledFromTypeScript: shouldTranspileTypeScript,
  };
}

function toWrapperLanguage(language: string): WrapperLanguage | null {
  if (
    language === "javascript" ||
    language === "typescript" ||
    language === "python" ||
    language === "java" ||
    language === "cpp" ||
    language === "c"
  ) {
    return language;
  }

  return null;
}

/** Judge0 cpu_time applies to compile+run; interpreted / JVM need higher floors than problem.timeLimitMs. */
function resolveSubmissionLimits(
  languageId: number,
  problem: ExecutionProblemConfig
): { cpu: number; wall: number; memory: number } {
  const computed = computeExecutionLimits(languageId, problem.timeLimitMs, problem.memoryLimitKb);
  return {
    cpu: computed.cpu_time_limit,
    wall: computed.wall_time_limit,
    memory: computed.memory_limit,
  };
}

function mapJudgeStatus(statusId: number): "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "IE" {
  switch (statusId) {
    case 3:
      return "AC";
    case 5:
      return "TLE";
    case 6:
      return "CE";
    case 13:
      return "MLE";
    case 4:
      return "WA";
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 14:
      return "RE";
    default:
      return "IE";
  }
}

function supportsWrappedExecution(problem: ExecutionProblemConfig, language: string): boolean {
  const wrapperLanguage = toWrapperLanguage(language);
  const parameterTypes = parseParameterTypes(problem.parameterTypes);
  return Boolean(wrapperLanguage && problem.functionName && problem.returnType && parameterTypes.length > 0);
}

function parseInputJson(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Test case input must be an object for wrapped execution mode");
  }
  return parsed as Record<string, unknown>;
}

export async function executeSubmissionCases(params: {
  problem: ExecutionProblemConfig;
  userCode: string;
  language: string;
  testCases: ExecutionTestCase[];
  skipComparison?: boolean;
}): Promise<ExecutionSummary> {
  const { problem, userCode, language, testCases, skipComparison = false } = params;

  const { effectiveLanguage, effectiveUserCode } = normalizeExecutionSource(language, userCode);

  const languageId = await getJudge0LanguageId(effectiveLanguage);
  if (!languageId) {
    throw new Error(`Unsupported language: ${effectiveLanguage}`);
  }

  const parameterTypes = parseParameterTypes(problem.parameterTypes);
  const wrapperLanguage = toWrapperLanguage(effectiveLanguage);
  const wrappedMode = supportsWrappedExecution(problem, effectiveLanguage);

  logger.info(
    {
      problemId: problem.id,
      language,
      wrappedMode,
      compareMode: problem.compareMode,
      testCases: testCases.length,
    },
    "Executing submission against Judge0"
  );

  const results: ExecutionCaseResult[] = [];
  let source_code = effectiveUserCode;
  if (wrappedMode && wrapperLanguage) {
    source_code = generateWrappedCode(wrapperLanguage, effectiveUserCode, {
      functionName: problem.functionName!,
      parameterTypes,
      returnType: problem.returnType as ParameterTypeDef["type"],
    });
  }

  const preparedCases = testCases.map((testCase, index) => {
    const stdin = wrappedMode && wrapperLanguage
      ? serializeInput(parseInputJson(testCase.input), parameterTypes)
      : testCase.input;

    logger.info(
      {
        language,
        languageId,
        wrappedMode,
        caseIndex: index,
        stdin,
        expected: testCase.expectedOutput,
      },
      "Execution debug payload"
    );

    return {
      stdin,
      expectedOutput: testCase.expectedOutput,
    };
  });

  const { cpu, wall, memory: memoryLimitKb } = resolveSubmissionLimits(languageId, problem);
  const batchResults = await runBatch(
    source_code,
    languageId,
    preparedCases.map((testCase) => ({
      input: testCase.stdin,
      expected_output: skipComparison ? undefined : testCase.expectedOutput,
    })),
    {
      cpu_time_limit: cpu,
      wall_time_limit: wall,
      memory_limit: memoryLimitKb,
    }
  );

  for (let index = 0; index < batchResults.length; index++) {
    const judgeResult = batchResults[index]!;
    const expectedOutput = testCases[index]?.expectedOutput ?? "";
    const runtime = judgeResult.time ? Math.round(parseFloat(judgeResult.time) * 1000) : 0;
    const memory = judgeResult.memory ?? 0;

    const baseVerdict = mapJudgeStatus(judgeResult.status.id);
    let verdict = baseVerdict;
    let passed = verdict === "AC";

    if (judgeResult.status.id === 3 && !skipComparison) {
      const actual = judgeResult.stdout ?? "";
      passed = compareOutput(actual, expectedOutput, problem.compareMode);
      verdict = passed ? "AC" : "WA";
    } else if (judgeResult.status.id === 3 && skipComparison) {
      passed = true;
      verdict = "AC";
    }

    results.push({
      caseIndex: index,
      passed,
      verdict,
      stdout: judgeResult.stdout,
      expected: expectedOutput,
      stderr: judgeResult.stderr,
      compileOutput: judgeResult.compile_output,
      runtime,
      memory,
    });
  }

  const passedCount = results.filter((entry) => entry.passed).length;
  const totalCount = results.length;
  const firstFailure = results.find((entry) => !entry.passed);

  return {
    overallVerdict: firstFailure?.verdict ?? "AC",
    passedCount,
    totalCount,
    results,
    maxRuntime: Math.max(0, ...results.map((entry) => entry.runtime)),
    maxMemory: Math.max(0, ...results.map((entry) => entry.memory)),
  };
}
