export type Verdict = "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "PENDING" | "JUDGING";

export interface TestResult {
  caseIndex: number;
  verdict: Verdict;
  stdout: string | null;
  expected: string | null;
  stderr: string | null;
  compileOutput: string | null;
  runtime: number | null;
  memory: number | null;
  passed: boolean;
}

export interface SubmissionResult {
  submissionId: string;
  verdict: Verdict;
  runtime: number | null;
  memory: number | null;
  testResults: TestResult[];
  submittedAt: string;
}
