"use client";

import { Suspense, use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Loader2, Play, RotateCcw, Settings2, Terminal, Timer, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatMemory, formatRelativeTime, formatRuntime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CodeEditor, type CodeEditorRef } from "@repo/ui/editor/CodeEditor";
import { StatusChip } from "@repo/ui/common/StatusChip";
import type { ApiResponse, TestResult } from "@repo/types";
import { useProblemStore } from "@/stores/problemStore";
import { useSubmission } from "@/hooks/useSubmission";
import { SubmissionResultPanel } from "@/components/coding/SubmissionResultPanel";
import { DiffViewer } from "@/components/coding/DiffViewer";

interface ProblemDetailResponse {
  id: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  description: string;
  tags: string[];
  constraints?: string | null;
  sampleInput?: string | null;
  sampleOutput?: string | null;
  acceptanceRate: number;
  acceptedCount: number;
  totalCount: number;
  testCases: { id: string; input: string; expectedOutput: string; isSample: boolean }[];
  hints: string[];
  starterCode?: Partial<Record<string, string>>;
  contestContext?: {
    contestId: string;
    points: number;
    hasAttempted: boolean;
    hasAccepted: boolean;
    isRegistered: boolean;
    status: "UPCOMING" | "LIVE" | "ENDED";
    endTime: string;
  } | null;
}

interface SubmissionHistoryItem {
  id: string;
  code: string;
  language: string;
  runtime?: number | null;
  memory?: number | null;
  createdAt: string;
  verdictLabel: "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "JUDGING";
}

const DEFAULT_CODE: Record<string, string> = {
  javascript: "function solve(input) {\n  // Write your solution here\n}\n",
  typescript: "function solve(input: string) {\n  // Write your solution here\n}\n",
  python: "def solve():\n    pass\n",
  java: "public class Main {\n  public static void main(String[] args) {\n    // Write your solution here\n  }\n}\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  // Write your solution here\n  return 0;\n}\n",
  c: "#include <stdio.h>\n\nint main(void) {\n  // Write your solution here\n  return 0;\n}\n",
  go: "package main\n\nfunc main() {\n  // Write your solution here\n}\n",
  rust: "fn main() {\n  // Write your solution here\n}\n",
};

function getDefaultCode(language: string) {
  return DEFAULT_CODE[language] ?? DEFAULT_CODE["python"]!;
}

function getPreferredCode(problem: ProblemDetailResponse | undefined, language: string) {
  return problem?.starterCode?.[language] ?? getDefaultCode(language);
}

const markdownComponents = {
  pre({ children, ...props }: { children?: ReactNode }) {
    return (
      <pre className="overflow-x-auto rounded-lg bg-muted p-4" {...props}>
        {children}
      </pre>
    );
  },
  code({ className, children, ...props }: { className?: string; children?: ReactNode }) {
    return (
      <code className={cn("font-mono text-sm", className)} {...props}>
        {children}
      </code>
    );
  },
};

function ProblemPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const contestId = searchParams.get("contestId");
  const editorRef = useRef<CodeEditorRef>(null);
  const hydratedCodeKeyRef = useRef<string | null>(null);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [customCases, setCustomCases] = useState<string[]>([""]);
  const [consoleText, setConsoleText] = useState("");
  const [historyDialog, setHistoryDialog] = useState<SubmissionHistoryItem | null>(null);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);
  const [isTestPanelCollapsed, setIsTestPanelCollapsed] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<"description" | "solutions" | "submissions" | "hints">("description");
  const [activeBottomTab, setActiveBottomTab] = useState<"testcase" | "result">("testcase");
  const [activeTestCase, setActiveTestCase] = useState(0);
  const code = useProblemStore((state) => state.code);
  const language = useProblemStore((state) => state.language);
  const fontSize = useProblemStore((state) => state.fontSize);
  const isRunning = useProblemStore((state) => state.isRunning);
  const isSubmitting = useProblemStore((state) => state.isSubmitting);
  const runResults = useProblemStore((state) => state.runResults);
  const submissionResult = useProblemStore((state) => state.submissionResult);
  const setCode = useProblemStore((state) => state.setCode);
  const setLanguage = useProblemStore((state) => state.setLanguage);
  const setFontSize = useProblemStore((state) => state.setFontSize);
  const setRunResults = useProblemStore((state) => state.setRunResults);
  const setSubmissionResult = useProblemStore((state) => state.setSubmissionResult);
  const setRunning = useProblemStore((state) => state.setRunning);
  const setSubmitting = useProblemStore((state) => state.setSubmitting);
  const { submitCode } = useSubmission(id, contestId);

  const { data, isLoading } = useQuery({
    queryKey: ["problem-detail", id, contestId],
    queryFn: () => api.get<ApiResponse<ProblemDetailResponse>>(`/api/problems/${id}${contestId ? `?contestId=${contestId}` : ""}`),
  });

  const { data: historyData } = useQuery({
    queryKey: ["problem-history", id, contestId],
    queryFn: () => api.get<ApiResponse<SubmissionHistoryItem[]>>(`/api/problems/${id}/submissions${contestId ? `?contestId=${contestId}` : ""}`),
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
  const nextProblem = currentIndex >= 0 && currentIndex < problemList.length - 1 ? problemList[currentIndex + 1] : null;
  const activeCode = code[`${id}:${language}`] ?? getPreferredCode(problem, language);
  const examples = useMemo(() => (problem?.testCases ?? []).filter((testCase) => testCase.isSample), [problem?.testCases]);
  const activeCustomInput = customCases[activeTestCase] ?? "";
  const activeRunResult = runResults?.[activeTestCase] ?? runResults?.[0] ?? null;
  const isContestAttemptLocked = !!contestContext?.hasAttempted;
  const submitDisabled = isSubmitting || (contestContext ? isContestAttemptLocked || contestContext.status !== "LIVE" || !contestContext.isRegistered : false);

  useEffect(() => {
    setElapsedSeconds(0);
    setCustomCases([""]);
    setConsoleText("");
    setHistoryDialog(null);
    setIsConsoleCollapsed(false);
    setIsTestPanelCollapsed(false);
    setTimerStartedAt(null);
    setActiveLeftTab("description");
    setActiveBottomTab("testcase");
    setActiveTestCase(0);
    hydratedCodeKeyRef.current = null;
  }, [id]);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(`rankroom:language:${id}`);
    if (savedLanguage && savedLanguage !== language) {
      setLanguage(savedLanguage);
      return;
    }

    const codeKey = `${id}:${language}`;
    if (hydratedCodeKeyRef.current === codeKey) return;
    hydratedCodeKeyRef.current = codeKey;

    const savedCode = window.localStorage.getItem(`rankroom:code:${codeKey}`);
    if (savedCode && savedCode !== code[codeKey]) {
      setCode(id, language, savedCode);
      return;
    }

    if (!code[codeKey]) {
      setCode(id, language, getPreferredCode(problem, language));
    }
  }, [code, id, language, problem, setCode, setLanguage]);

  useEffect(() => {
    window.localStorage.setItem(`rankroom:language:${id}`, language);
    const timeout = setTimeout(() => {
      window.localStorage.setItem(`rankroom:code:${id}:${language}`, activeCode);
    }, 500);
    return () => clearTimeout(timeout);
  }, [activeCode, id, language]);

  useEffect(() => {
    if (timerStartedAt === null) return;
    const interval = setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [timerStartedAt]);

  useEffect(() => {
    if (activeTestCase >= customCases.length) {
      setActiveTestCase(Math.max(0, customCases.length - 1));
    }
  }, [activeTestCase, customCases.length, setActiveTestCase]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleRun();
      }
      if (event.ctrlKey && event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        void handleSubmit();
      }
      if (event.ctrlKey && event.key === "`") {
        event.preventDefault();
        setIsConsoleCollapsed((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function updateCustomCase(index: number, value: string) {
    setCustomCases((current) => current.map((entry, entryIndex) => (entryIndex === index ? value : entry)));
  }

  function addCustomCase() {
    setCustomCases((current) => [...current, ""]);
    setActiveTestCase(customCases.length);
  }

  async function handleRun() {
    if (!problem) return;
    setRunning(true);
    setActiveBottomTab("result");
    setSubmissionResult(null);
    setConsoleText("Running on Judge0...");
    try {
      const response = await api.post<ApiResponse<{ results: TestResult[] }>>(`/api/problems/${problem.id}/run`, {
        source_code: activeCode,
        language,
        stdin: activeCustomInput || undefined,
      });
      setRunResults(response.data?.results ?? []);
      setConsoleText((response.data?.results ?? []).map((result) => result.stdout ?? result.stderr ?? result.compileOutput ?? result.verdict).join("\n\n"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to run code right now.";
      setRunResults(null);
      setConsoleText(message);
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    if (!problem) return;
    setSubmitting(true);
    setRunResults(null);
    setConsoleText("Judging on Judge0...");
    try {
      await submitCode(activeCode, language);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit code right now.";
      setConsoleText(message);
      setSubmitting(false);
    }
  }

  if (isLoading || !problem) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[calc(100vh-8rem)] w-full" />
      </div>
    );
  }

  return (
    <div className="-m-6 flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">R</span>
          <div className="flex items-center gap-2">
            <Link href={contestId ? `/contests/${contestId}/problems` : "/problems"} className="text-muted-foreground">
              {contestId ? "Contest Problems" : "Problems"}
            </Link>
            <span className="text-muted-foreground">›</span>
            <span>{problem.title}</span>
          </div>
          <Badge variant="outline" className="text-xs">{currentIndex >= 0 ? currentIndex + 1 : "--"}</Badge>
          {contestContext ? <Badge variant="secondary" className="text-xs">{contestContext.points} pts</Badge> : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled={!previousProblem} asChild>{previousProblem ? <Link href={`/problems/${previousProblem.id}`}><ChevronLeft className="h-4 w-4" /></Link> : <span><ChevronLeft className="h-4 w-4" /></span>}</Button>
          <div className="max-w-xs truncate text-sm font-medium">{problem.title}</div>
          <Button variant="ghost" size="icon" disabled={!nextProblem} asChild>{nextProblem ? <Link href={`/problems/${nextProblem.id}`}><ChevronRight className="h-4 w-4" /></Link> : <span><ChevronRight className="h-4 w-4" /></span>}</Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={cn(problem.difficulty === "EASY" && "bg-green-400/10 text-green-400", problem.difficulty === "MEDIUM" && "bg-yellow-400/10 text-yellow-400", problem.difficulty === "HARD" && "bg-red-400/10 text-red-400")}>{problem.difficulty}</Badge>
          <div className="h-5 w-px bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTimerStartedAt((current) => (current === null ? Date.now() : null))}
          >
            <Timer className="mr-2 h-4 w-4" />
            {timerStartedAt === null ? "Start" : "Pause"} {new Date(elapsedSeconds * 1000).toISOString().slice(11, 19)}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setElapsedSeconds(0); setTimerStartedAt(null); }}>
            Reset
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><Settings2 className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {[12, 13, 14, 15, 16].map((size) => (
                <DropdownMenuItem key={size} onClick={() => setFontSize(size)}>
                  Font size {size}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="bg-green-500 text-white hover:bg-green-600" onClick={() => void handleSubmit()} disabled={submitDisabled}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {contestContext && isContestAttemptLocked ? "Attempt Used" : "Submit"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleRun()} disabled={isRunning}>{isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Run</Button>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={40} minSize={30} maxSize={55}>
          <ResizablePanelGroup direction="vertical" className="h-full">
            <ResizablePanel defaultSize={65} minSize={45}>
              <Tabs value={activeLeftTab} onValueChange={(value) => setActiveLeftTab(value as typeof activeLeftTab)} className="h-full">
                <div className="border-b border-border px-4 pt-3">
                  <TabsList className="bg-transparent p-0">
                    <TabsTrigger value="description">Description</TabsTrigger>
                    <TabsTrigger value="solutions">Solutions</TabsTrigger>
                    <TabsTrigger value="submissions">Submissions</TabsTrigger>
                    <TabsTrigger value="hints">Hints</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="description" className="h-[calc(100%-3rem)]">
                  <ScrollArea className="h-full px-6 py-5">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-xl font-bold">{problem.title}</h1>
                          <Badge className={cn(problem.difficulty === "EASY" && "bg-green-400/10 text-green-400", problem.difficulty === "MEDIUM" && "bg-yellow-400/10 text-yellow-400", problem.difficulty === "HARD" && "bg-red-400/10 text-red-400")}>{problem.difficulty}</Badge>
                          {problem.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                        </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>Accepted: {problem.acceptedCount}</span>
                          <span>Submissions: {problem.totalCount}</span>
                          <span>Acceptance Rate: {problem.acceptanceRate.toFixed(1)}%</span>
                          {contestContext ? <span>Contest Points: {contestContext.points}</span> : null}
                      </div>
                      {contestContext ? (
                        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                          {contestContext.hasAttempted
                            ? "You already used your contest attempt for this problem."
                            : contestContext.status !== "LIVE"
                              ? `Contest is ${contestContext.status.toLowerCase()}. Submission is only enabled while it is live.`
                              : !contestContext.isRegistered
                                ? "Register for the contest before submitting."
                                : "Contest mode: one submission attempt only, and standings use the contest point value."}
                        </div>
                      ) : null}
                      </div>

                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {problem.description}
                        </ReactMarkdown>
                      </div>

                      {examples.map((example, index) => (
                        <div key={example.id} className="space-y-2">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Example {index + 1}</h3>
                          <div className="rounded-lg bg-muted p-3 font-mono text-sm">
                            <p><span className="text-muted-foreground">Input:</span> {example.input}</p>
                            <p><span className="text-muted-foreground">Output:</span> {example.expectedOutput}</p>
                          </div>
                        </div>
                      ))}

                      {problem.constraints && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Constraints</h3>
                          <ul className="grid gap-2">
                            {problem.constraints.split("\n").filter(Boolean).map((constraint) => <li key={constraint} className="w-fit rounded-md bg-muted px-2 py-1 font-mono text-sm">{constraint}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="solutions" className="px-6 py-5 text-sm text-muted-foreground">Official solutions are not available yet.</TabsContent>
                <TabsContent value="submissions" className="px-6 py-5">
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[120px,100px,100px,100px,140px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Status</span>
                      <span>Language</span>
                      <span>Runtime</span>
                      <span>Memory</span>
                      <span>Submitted</span>
                    </div>
                    {history.length > 0 ? (
                      history.map((submission) => (
                        <button
                          key={submission.id}
                          className="grid w-full grid-cols-[120px,100px,100px,100px,140px] items-center gap-3 border-b border-border bg-card px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/40"
                          onClick={() => setHistoryDialog(submission)}
                        >
                          <StatusChip verdict={submission.verdictLabel} size="sm" />
                          <span className="text-sm text-muted-foreground">{submission.language}</span>
                          <span className="text-sm text-muted-foreground">{formatRuntime(submission.runtime)}</span>
                          <span className="text-sm text-muted-foreground">{formatMemory(submission.memory)}</span>
                          <span className="text-sm text-muted-foreground">{formatRelativeTime(submission.createdAt)}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-sm text-muted-foreground">No submissions yet for this problem.</div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="hints" className="px-6 py-5">
                  {problem.hints.length > 0 ? (
                    <Accordion type="single" collapsible>
                      {problem.hints.map((hint, index) => <AccordionItem key={index} value={`hint-${index}`}><AccordionTrigger>{`Hint ${index + 1}`}</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground">{hint}</AccordionContent></AccordionItem>)}
                    </Accordion>
                  ) : <p className="text-sm text-muted-foreground">No hints available yet.</p>}
                </TabsContent>
              </Tabs>
            </ResizablePanel>

            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={15} collapsible collapsedSize={8}>
              <Tabs value={activeBottomTab} onValueChange={(value) => setActiveBottomTab(value as typeof activeBottomTab)} className="h-full">
                <div className="flex items-center justify-between border-b border-border px-4 pt-3">
                  <TabsList className="bg-transparent p-0">
                    <TabsTrigger value="testcase">Testcase</TabsTrigger>
                    <TabsTrigger value="result">Test Result</TabsTrigger>
                  </TabsList>
                  <Button variant="ghost" size="icon" onClick={() => setIsTestPanelCollapsed((current) => !current)}>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isTestPanelCollapsed && "rotate-180")} />
                  </Button>
                </div>
                {!isTestPanelCollapsed ? (
                  <>
                <TabsContent value="testcase" className="h-[calc(100%-3rem)] px-4 py-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-2">
                        {customCases.map((_, index) => (
                          <Button
                            key={index}
                            variant={activeTestCase === index ? "secondary" : "ghost"}
                            size="sm"
                            className="rounded-t-md"
                            onClick={() => setActiveTestCase(index)}
                          >
                            Case {index + 1}
                          </Button>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="ml-auto" onClick={addCustomCase}>+</Button>
                    </div>
                    <textarea value={activeCustomInput} onChange={(event) => updateCustomCase(activeTestCase, event.target.value)} className="h-24 w-full resize-none rounded-md border border-border bg-muted/50 p-2 font-mono text-sm focus:border-primary focus:outline-none" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Expected Output</p>
                      <pre className="rounded-md bg-muted p-3 text-sm">{examples[activeTestCase]?.expectedOutput ?? examples[0]?.expectedOutput ?? "Run custom input or sample tests to compare output."}</pre>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="result" className="h-[calc(100%-3rem)] px-4 py-4">
                  {activeRunResult ? (
                    <div className="space-y-4">
                      <StatusChip verdict={activeRunResult.verdict} size="md" />
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">Runtime: {formatRuntime(activeRunResult.runtime)}</Badge>
                        <Badge variant="outline">Memory: {formatMemory(activeRunResult.memory)}</Badge>
                        <Badge variant="outline">Exit code: {activeRunResult.passed ? 0 : 1}</Badge>
                      </div>
                      <div className="grid gap-3">
                        <div><p className="mb-1 text-xs text-muted-foreground">Input</p><pre className="rounded-md bg-muted p-3 text-sm">{activeCustomInput || examples[activeTestCase]?.input || examples[0]?.input || ""}</pre></div>
                        <div><p className="mb-1 text-xs text-muted-foreground">Expected Output</p><pre className="rounded-md bg-muted p-3 text-sm">{activeRunResult.expected ?? ""}</pre></div>
                        <div>
                          <p className="mb-1 text-xs text-muted-foreground">Your Output</p>
                          {activeRunResult.verdict === "WA" ? <DiffViewer expected={activeRunResult.expected ?? ""} actual={activeRunResult.stdout ?? ""} /> : <pre className={cn("rounded-md p-3 text-sm", activeRunResult.compileOutput ? "border border-red-500/40 bg-red-950/20 text-red-200" : "bg-muted")}>{activeRunResult.stdout ?? activeRunResult.stderr ?? activeRunResult.compileOutput ?? ""}</pre>}
                        </div>
                      </div>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Run your code to inspect testcase results.</p>}
                </TabsContent>
                  </>
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Test panel collapsed.</div>
                )}
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={60} minSize={45} maxSize={70}>
          <ResizablePanelGroup direction="vertical" className="h-full">
            <ResizablePanel defaultSize={70} minSize={45}>
              <div className="flex h-full flex-col bg-card">
                <div className="flex h-10 items-center gap-2 border-b border-border px-3">
                  <Select value={language} onValueChange={(value) => setLanguage(value)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(DEFAULT_CODE).map((lang) => <SelectItem key={lang} value={lang}>{lang === "cpp" ? "C++" : lang === "c" ? "C" : lang.charAt(0).toUpperCase() + lang.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={String(fontSize)} onValueChange={(value) => setFontSize(Number(value))}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>{[12, 13, 14, 15, 16].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setCode(id, language, getPreferredCode(problem, language))}><RotateCcw className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(activeCode)}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <CodeEditor ref={editorRef} language={language} value={activeCode} onChange={(value) => setCode(id, language, value)} fontSize={fontSize} className="h-full rounded-none border-0" minHeight={600} />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30} minSize={8} collapsible collapsedSize={8}>
              <div className="relative flex h-full flex-col border-t border-border bg-card">
                {isRunning && <div className="absolute left-0 top-0 h-0.5 w-full animate-pulse bg-primary" />}
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium"><Terminal className="h-4 w-4" />Console</div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setConsoleText("")}><Trash2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsConsoleCollapsed((current) => !current)}>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isConsoleCollapsed && "rotate-180")} />
                    </Button>
                  </div>
                </div>
                {!isConsoleCollapsed ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {isRunning ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Running on Judge0...</div>
                  ) : isSubmitting && !submissionResult ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Judging submission...</div>
                  ) : submissionResult ? (
                    <SubmissionResultPanel result={submissionResult} />
                  ) : consoleText ? (
                    <pre className="whitespace-pre-wrap text-sm">{consoleText}</pre>
                  ) : (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Terminal className="h-4 w-4" />Run your code to see output here</div>
                  )}
                </div>
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Console collapsed. Press Ctrl+` to toggle.</div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={!!historyDialog} onOpenChange={(open) => !open && setHistoryDialog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogTitle>Submitted Code</DialogTitle>
          {historyDialog && <div className="h-[70vh]"><CodeEditor language={historyDialog.language} value={historyDialog.code} readOnly minHeight={700} className="h-full" /></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="grid gap-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[calc(100vh-8rem)] w-full" /></div>}>
      <ProblemPageContent params={params} />
    </Suspense>
  );
}
