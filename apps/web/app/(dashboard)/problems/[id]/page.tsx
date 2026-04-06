"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeEditor, type CodeEditorRef } from "@repo/ui/editor/CodeEditor";
import type { ApiResponse, TestResult } from "@repo/types";
import { useProblemStore } from "@/stores/problemStore";
import { useSubmission } from "@/hooks/useSubmission";
import { AiDrawer } from "@/components/coding/AiDrawer";
import { ProblemWorkspace } from "@/components/coding/workspace/ProblemWorkspace";
import { ProblemNavbar } from "@/components/coding/workspace/ProblemNavbar";
import { DescriptionPanel, type SubmissionHistoryItem } from "@/components/coding/workspace/DescriptionPanel";
import { TestCasePanel, type BottomTab } from "@/components/coding/workspace/TestCasePanel";
import { EditorPanel } from "@/components/coding/workspace/EditorPanel";
import { generateBoilerplateCode, hasWrappedMeta } from "@/lib/boilerplate";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProblemDetailResponse {
  id: string;
  title: string;
  createdBy?: { id: string; name: string } | null;
  scope?: "GLOBAL" | "DEPARTMENT" | "SECTION";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  description: string;
  tags: string[];
  constraints?: string | null;
  acceptanceRate: number;
  acceptedCount: number;
  totalCount: number;
  testCases: { id: string; input: string; expectedOutput: string; isSample: boolean }[];
  hints: string[];
  editorial?: {
    summary?: string | null;
    approach?: string | null;
    complexity?: string | null;
    fullEditorial: string;
  } | null;
  boilerplates?: Array<{ language: string; code: string }>;
  starterCode?: Partial<Record<string, string>>;
  functionName?: string | null;
  parameterTypes?: { name: string; type: string }[] | null;
  returnType?: string | null;
  contestContext?: {
    contestId: string;
    points: number;
    hasAttempted: boolean;
    hasAccepted: boolean;
    isRegistered: boolean;
    status: "DRAFT" | "UPCOMING" | "SCHEDULED" | "REGISTRATION_OPEN" | "LIVE" | "FROZEN" | "ENDED" | "RESULTS_PUBLISHED";
    endTime: string;
    penaltyMinutes?: number;
    aiDisabled?: boolean;
  } | null;
}

// ── Fallback stubs (shown only if no starterCode and no wrapped metadata) ────

const GENERIC_STUBS: Record<string, string> = {
  python: "class Solution:\n    def solve(self):\n        pass\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n",
  c: "#include <stdio.h>\n\nint main(void) {\n    // Write your solution here\n    return 0;\n}\n",
};

const LANGUAGE_ORDER = ["python", "cpp", "c"] as const;

function getStarterCode(problem: ProblemDetailResponse, language: string): string {
  // 0. DB-backed boilerplate has highest priority.
  const dbBoilerplate = problem.boilerplates?.find((entry) => entry.language === language)?.code;
  if (dbBoilerplate && dbBoilerplate.trim().length > 0) return dbBoilerplate;

  // 1. Problem has explicit starter code for this language
  const explicit = problem.starterCode?.[language];
  if (explicit && explicit.trim().length > 0) return explicit;

  // 2. Problem has function metadata — generate proper boilerplate
  if (hasWrappedMeta(problem)) {
    const generated = generateBoilerplateCode(language, {
      functionName: problem.functionName!,
      parameterTypes: problem.parameterTypes!,
      returnType: problem.returnType!,
    });
    if (generated) return generated;
  }

  // 3. Fall back to generic stub
  return GENERIC_STUBS[language] ?? GENERIC_STUBS["python"]!;
}

// ── Main component ─────────────────────────────────────────────────────────────

function ProblemPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const contestId = searchParams.get("contestId");
  const queryClient = useQueryClient();
  const editorRef = useRef<CodeEditorRef>(null);
  const hydratedCodeKeyRef = useRef<string | null>(null);
  const initialLanguageHydratedRef = useRef<string | null>(null);

  // Timer state
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Test panel state
  const [customCases, setCustomCases] = useState<string[]>([""]);
  const [activeTestCase, setActiveTestCase] = useState(0);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("testcase");
  const [consoleText, setConsoleText] = useState("");

  // Dialog for viewing a historical submission
  const [historyDialog, setHistoryDialog] = useState<SubmissionHistoryItem | null>(null);
  const [activeLeftTab, setActiveLeftTab] = useState<"description" | "editorial" | "solutions" | "submissions" | "hints">("description");

  // AI drawer
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  // Problem store
  const code = useProblemStore((s) => s.code);
  const language = useProblemStore((s) => s.language);
  const fontSize = useProblemStore((s) => s.fontSize);
  const isRunning = useProblemStore((s) => s.isRunning);
  const isSubmitting = useProblemStore((s) => s.isSubmitting);
  const runResults = useProblemStore((s) => s.runResults);
  const submissionResult = useProblemStore((s) => s.submissionResult);
  const setCode = useProblemStore((s) => s.setCode);
  const setLanguage = useProblemStore((s) => s.setLanguage);
  const setFontSize = useProblemStore((s) => s.setFontSize);
  const setRunResults = useProblemStore((s) => s.setRunResults);
  const setSubmissionResult = useProblemStore((s) => s.setSubmissionResult);
  const setRunning = useProblemStore((s) => s.setRunning);
  const setSubmitting = useProblemStore((s) => s.setSubmitting);

  const { submitCode } = useSubmission(id, contestId);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ["problem-detail", id, contestId],
    queryFn: () =>
      api.get<ApiResponse<ProblemDetailResponse>>(
        `/api/problems/${id}${contestId ? `?contestId=${contestId}` : ""}`
      ),
  });

  const { data: historyData } = useQuery({
    queryKey: ["problem-history", id, contestId],
    queryFn: () =>
      api.get<ApiResponse<SubmissionHistoryItem[]>>(
        `/api/problems/${id}/submissions${contestId ? `?contestId=${contestId}` : ""}`
      ),
  });

  const { data: problemListData } = useQuery({
    queryKey: ["problem-nav"],
    queryFn: () => api.get<ApiResponse<{ id: string; title: string }[]>>("/api/problems?page=1&limit=100"),
  });

  const problem = data?.data;
  const contestContext = problem?.contestContext ?? null;
  const history = historyData?.data ?? [];
  const problemList = problemListData?.data ?? [];
  const currentIndex = problemList.findIndex((item) => item.id === id);
  const previousProblem = currentIndex > 0 ? problemList[currentIndex - 1] : null;
  const nextProblem =
    currentIndex >= 0 && currentIndex < problemList.length - 1 ? problemList[currentIndex + 1] : null;

  const activeCode = code[`${id}:${language}`] ?? (problem ? getStarterCode(problem, language) : GENERIC_STUBS[language] ?? "");

  const examples = useMemo(
    () => (problem?.testCases ?? []).filter((tc) => tc.isSample),
    [problem?.testCases]
  );

  const isWrappedProblem = problem ? hasWrappedMeta(problem) : false;

  const activeCustomInput = customCases[activeTestCase] ?? "";
  const activeRunResult = runResults?.[activeTestCase] ?? runResults?.[0] ?? null;

  const submitDisabled =
    isSubmitting ||
    (contestContext
      ? contestContext.hasAccepted ||
        !["LIVE", "FROZEN"].includes(contestContext.status) ||
        !contestContext.isRegistered
      : false);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // Reset state when problem ID changes
  useEffect(() => {
    setElapsedSeconds(0);
    setActiveBottomTab("testcase");
    setActiveTestCase(0);
    setConsoleText("");
    setHistoryDialog(null);
    setTimerStartedAt(null);
    setActiveLeftTab("description");
    setRunResults(null);
    setSubmissionResult(null);
    hydratedCodeKeyRef.current = null;
    initialLanguageHydratedRef.current = null;
  }, [id, setRunResults, setSubmissionResult]);

  // Pre-populate custom cases from sample examples when problem loads
  useEffect(() => {
    if (!problem || examples.length === 0) return;
    // Only pre-populate on initial load (when customCases is still the default empty array)
    setCustomCases((prev) => {
      if (prev.length === 1 && prev[0] === "") {
        return examples.map((ex) => ex.input);
      }
      return prev;
    });
  }, [examples, problem]);

  // Restore language from localStorage
  useEffect(() => {
    if (!id) return;
    if (initialLanguageHydratedRef.current !== id) {
      initialLanguageHydratedRef.current = id;
      const saved = window.localStorage.getItem(`rankroom:language:${id}`);
      if (saved && LANGUAGE_ORDER.includes(saved as (typeof LANGUAGE_ORDER)[number]) && saved !== language) {
        setLanguage(saved);
        return;
      }
      if (!LANGUAGE_ORDER.includes(language as (typeof LANGUAGE_ORDER)[number])) {
        setLanguage("python");
        return;
      }
    }

    // Restore code
    const codeKey = `${id}:${language}`;
    if (hydratedCodeKeyRef.current === codeKey) return;
    const savedCode = window.localStorage.getItem(`rankroom:code:${codeKey}`);
    const currentCode = code[codeKey];
    if (savedCode && savedCode !== currentCode) {
      hydratedCodeKeyRef.current = codeKey;
      setCode(id, language, savedCode);
    } else if (!currentCode && problem) {
      hydratedCodeKeyRef.current = codeKey;
      setCode(id, language, getStarterCode(problem, language));
    }
  }, [id, language, problem, code, setCode, setLanguage]);

  // Persist code to localStorage
  useEffect(() => {
    if (!hydratedCodeKeyRef.current) return;
    window.localStorage.setItem(`rankroom:language:${id}`, language);
    const timeout = setTimeout(() => {
      window.localStorage.setItem(`rankroom:code:${id}:${language}`, activeCode);
    }, 500);
    return () => clearTimeout(timeout);
  }, [activeCode, id, language]);

  // Timer
  useEffect(() => {
    if (timerStartedAt === null) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [timerStartedAt]);

  // Clamp active test case when case list shrinks
  useEffect(() => {
    if (activeTestCase >= customCases.length) {
      setActiveTestCase(Math.max(0, customCases.length - 1));
    }
  }, [activeTestCase, customCases.length]);

  useEffect(() => {
    if (!submissionResult || submissionResult.verdict === "PENDING" || submissionResult.verdict === "JUDGING") {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["problem-history", id, contestId] });
    void queryClient.invalidateQueries({ queryKey: ["problem-detail", id, contestId] });
  }, [contestId, id, queryClient, submissionResult]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function cycleLanguage(direction: 1 | -1) {
    const ci = LANGUAGE_ORDER.indexOf(language as (typeof LANGUAGE_ORDER)[number]);
    const ni = (Math.max(ci, 0) + direction + LANGUAGE_ORDER.length) % LANGUAGE_ORDER.length;
    setLanguage(LANGUAGE_ORDER[ni]);
  }

  const handleRun = useCallback(async () => {
    if (!problem) return;
    setRunning(true);
    setActiveBottomTab("result");
    setSubmissionResult(null);
    setConsoleText("Running on Judge0…");
    try {
      const response = await api.post<ApiResponse<{ results: TestResult[] }>>(
        `/api/problems/${problem.id}/run`,
        {
          source_code: activeCode,
          language,
          // Send custom input only if user has modified the default (non-empty)
          stdin: activeCustomInput.trim() ? activeCustomInput : undefined,
        }
      );
      const results = response.data?.results ?? [];
      setRunResults(results);
      // Build console text from all results
      setConsoleText(
        results
          .map((r) => {
            const lines: string[] = [];
            if (r.stdout) lines.push(r.stdout.trim());
            if (r.stderr) lines.push(`[stderr] ${r.stderr.trim()}`);
            if (r.compileOutput) lines.push(`[compile] ${r.compileOutput.trim()}`);
            if (!r.stdout && !r.stderr && !r.compileOutput) lines.push(r.verdict);
            return lines.join("\n");
          })
          .join("\n\n--- Next case ---\n\n")
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to run code right now.";
      setRunResults(null);
      setConsoleText(msg);
    } finally {
      setRunning(false);
    }
  }, [activeCode, activeCustomInput, language, problem, setRunResults, setRunning, setSubmissionResult]);

  const handleSubmit = useCallback(async () => {
    if (!problem) return;
    setSubmitting(true);
    setRunResults(null);
    setActiveBottomTab("console");
    setConsoleText("Judging on Judge0…");
    try {
      await submitCode(activeCode, language);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to submit right now.";
      setConsoleText(msg);
      setSubmitting(false);
    }
  }, [activeCode, language, problem, setRunResults, setSubmitting, submitCode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === "Enter") { e.preventDefault(); void handleRun(); }
      if (meta && e.key === "'") { e.preventDefault(); void handleSubmit(); }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        window.localStorage.setItem(`rankroom:code:${id}:${language}`, activeCode);
      }
      if (meta && e.key === "[") { e.preventDefault(); cycleLanguage(-1); }
      if (meta && e.key === "]") { e.preventDefault(); cycleLanguage(1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRun, handleSubmit, id, language, activeCode]);

  // ── Case management ────────────────────────────────────────────────────────

  function updateCustomCase(index: number, value: string) {
    setCustomCases((prev) => prev.map((c, i) => (i === index ? value : c)));
  }

  function addCustomCase() {
    setCustomCases((prev) => [...prev, ""]);
    setActiveTestCase(customCases.length);
    setActiveBottomTab("testcase");
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading || !problem) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[calc(100vh-4rem)] w-full" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <AiDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        problemId={id}
        problemTitle={problem.title}
        problemDescription={problem.description}
        code={activeCode}
        language={language}
      />

      <ProblemWorkspace
        navbar={
          <ProblemNavbar
            contestId={contestId}
            problemId={problem.id}
            problemTitle={problem.title}
            problemDifficulty={problem.difficulty}
            currentIndex={currentIndex}
            previousProblemId={previousProblem?.id ?? null}
            nextProblemId={nextProblem?.id ?? null}
            contestContext={contestContext}
            elapsedSeconds={elapsedSeconds}
            timerStarted={timerStartedAt !== null}
            isRunning={isRunning}
            isSubmitting={isSubmitting}
            submitDisabled={submitDisabled}
            fontSize={fontSize}
            onRun={() => void handleRun()}
            onSubmit={() => void handleSubmit()}
            onToggleTimer={() => setTimerStartedAt((t) => (t === null ? Date.now() : null))}
            onResetTimer={() => { setElapsedSeconds(0); setTimerStartedAt(null); }}
            onOpenAi={() => setAiDrawerOpen(true)}
            onFontSizeChange={setFontSize}
          />
        }
        leftPanel={
          <DescriptionPanel
            problem={problem}
            history={history}
            contestContext={contestContext}
            activeLeftTab={activeLeftTab}
            onLeftTabChange={setActiveLeftTab}
            onOpenHistory={setHistoryDialog}
          />
        }
        editorPanel={
          <EditorPanel
            editorRef={editorRef}
            language={language}
            fontSize={fontSize}
            code={activeCode}
            onLanguageChange={(lang) => {
              setLanguage(lang);
              // Reset code to starter for new language if not saved
              const codeKey = `${id}:${lang}`;
              if (!code[codeKey]) {
                const saved = window.localStorage.getItem(`rankroom:code:${codeKey}`);
                setCode(id, lang, saved ?? getStarterCode(problem, lang));
              }
            }}
            onFontSizeChange={setFontSize}
            onCodeChange={(v) => setCode(id, language, v)}
            onResetCode={() => setCode(id, language, getStarterCode(problem, language))}
          />
        }
        bottomPanel={
          <TestCasePanel
            activeTab={activeBottomTab}
            onTabChange={setActiveBottomTab}
            customCases={customCases}
            activeTestCase={activeTestCase}
            onSelectCase={setActiveTestCase}
            onAddCase={addCustomCase}
            activeCustomInput={activeCustomInput}
            onChangeCustomInput={(v) => updateCustomCase(activeTestCase, v)}
            examples={examples}
            runResults={runResults}
            submissionResult={submissionResult}
            isRunning={isRunning}
            isSubmitting={isSubmitting}
            isWrappedProblem={isWrappedProblem}
            consoleText={consoleText}
            onClearConsole={() => {
              setConsoleText("");
              setRunResults(null);
              setSubmissionResult(null);
            }}
          />
        }
      />

      {/* History viewer dialog */}
      <Dialog open={!!historyDialog} onOpenChange={(open) => !open && setHistoryDialog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogTitle>Submitted Code</DialogTitle>
          {historyDialog && (
            <div className="h-[70vh]">
              <CodeEditor
                language={historyDialog.language}
                value={historyDialog.code}
                readOnly
                minHeight={700}
                className="h-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[calc(100vh-4rem)] w-full" />
        </div>
      }
    >
      <ProblemPageContent params={params} />
    </Suspense>
  );
}
