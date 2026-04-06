"use client";

import { ChevronDown, Loader2, Terminal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusChip } from "@repo/ui/common/StatusChip";
import { cn, formatMemory, formatRuntime } from "@/lib/utils";
import { DiffViewer } from "@/components/coding/DiffViewer";
import { SubmissionResultPanel } from "@/components/coding/SubmissionResultPanel";
import { formatWrappedInput } from "@/lib/boilerplate";
import type { TestResult, SubmissionResult } from "@repo/types";

interface ExampleCase {
  id: string;
  input: string;
  expectedOutput: string;
}

export type BottomTab = "testcase" | "result" | "console";

interface TestCasePanelProps {
  activeTab: BottomTab;
  onTabChange: (value: BottomTab) => void;
  /** The visible custom input values for each case slot */
  customCases: string[];
  activeTestCase: number;
  onSelectCase: (index: number) => void;
  onAddCase: () => void;
  activeCustomInput: string;
  onChangeCustomInput: (value: string) => void;
  /** Sample test cases from the problem */
  examples: ExampleCase[];
  /** Per-case run results (index matches customCases) */
  runResults: TestResult[] | null;
  /** Final submission result */
  submissionResult: SubmissionResult | null;
  /** Whether code is currently being run */
  isRunning: boolean;
  /** Whether code is currently being submitted */
  isSubmitting: boolean;
  /** Whether this is a wrapped problem (input should be JSON) */
  isWrappedProblem: boolean;
  consoleText: string;
  onClearConsole: () => void;
}

export function TestCasePanel({
  activeTab,
  onTabChange,
  customCases,
  activeTestCase,
  onSelectCase,
  onAddCase,
  activeCustomInput,
  onChangeCustomInput,
  examples,
  runResults,
  submissionResult,
  isRunning,
  isSubmitting,
  isWrappedProblem,
  consoleText,
  onClearConsole,
}: TestCasePanelProps) {
  const activeResult = runResults?.[activeTestCase] ?? runResults?.[0] ?? null;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as BottomTab)}
      className="relative flex h-full flex-col bg-card"
    >
      {/* Animated running indicator */}
      {isRunning && (
        <div className="absolute left-0 top-0 z-10 h-0.5 w-full animate-pulse bg-primary" />
      )}

      {/* Tab header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 pt-2">
        <TabsList className="bg-transparent p-0">
          <TabsTrigger value="testcase">Testcase</TabsTrigger>
          <TabsTrigger value="result">
            Test Result
            {runResults && (
              <span className="ml-2 flex gap-0.5">
                {runResults.map((r) => (
                  <span
                    key={r.caseIndex}
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      r.passed ? "bg-green-400" : "bg-red-400"
                    )}
                  />
                ))}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="console">
            Console
            {isRunning && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
          </TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon" onClick={onClearConsole} title="Clear console">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Testcase tab ──────────────────────────────────────────── */}
      <TabsContent value="testcase" className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-3 p-4">
            {/* Case selector buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {customCases.map((_, index) => (
                <Button
                  key={index}
                  variant={activeTestCase === index ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 rounded-md px-3 text-xs"
                  onClick={() => onSelectCase(index)}
                >
                  {runResults?.[index] !== undefined ? (
                    <span
                      className={cn(
                        "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                        runResults[index]?.passed ? "bg-green-400" : "bg-red-400"
                      )}
                    />
                  ) : null}
                  Case {index + 1}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onAddCase}>
                +
              </Button>
            </div>

            {/* Custom input */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Input</p>
              {isWrappedProblem && (
                <p className="text-xs text-muted-foreground">
                  Format:{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                    {"{\"param1\": value1, \"param2\": value2}"}
                  </code>
                </p>
              )}
              <textarea
                value={activeCustomInput}
                onChange={(e) => onChangeCustomInput(e.target.value)}
                placeholder={
                  isWrappedProblem
                    ? examples[activeTestCase]?.input || '{"nums": [2, 7, 11, 15], "target": 9}'
                    : examples[activeTestCase]?.input || ""
                }
                className="h-24 w-full resize-none rounded-md border border-border bg-muted/50 p-2 font-mono text-sm focus:border-primary focus:outline-none"
              />
            </div>

            {/* Expected output */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Expected Output</p>
              <pre className="min-h-10 rounded-md bg-muted p-3 font-mono text-sm">
                {examples[activeTestCase]?.expectedOutput || "—"}
              </pre>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>

      {/* ── Result tab ───────────────────────────────────────────── */}
      <TabsContent value="result" className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            {isRunning ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running test cases…
              </div>
            ) : activeResult ? (
              <div className="space-y-4">
                {/* Case selector (with pass/fail dots) */}
                {runResults && runResults.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {runResults.map((r, i) => (
                      <Button
                        key={i}
                        size="sm"
                        variant={activeTestCase === i ? "secondary" : "ghost"}
                        className="h-7 gap-1.5 px-3 text-xs"
                        onClick={() => onSelectCase(i)}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            r.passed ? "bg-green-400" : "bg-red-400"
                          )}
                        />
                        Case {i + 1}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Verdict + meta */}
                <div className="flex flex-wrap items-center gap-3">
                  <StatusChip verdict={activeResult.verdict} size="md" />
                  <Badge variant="outline" className="font-mono text-xs">
                    {formatRuntime(activeResult.runtime)}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    {formatMemory(activeResult.memory)}
                  </Badge>
                </div>

                {/* Input / Expected / Actual */}
                <div className="grid gap-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Input</p>
                    <pre className="rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                      {isWrappedProblem && activeCustomInput
                        ? formatWrappedInput(activeCustomInput)
                        : (activeCustomInput || examples[activeTestCase]?.input || "—")}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Expected Output</p>
                    <pre className="rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                      {activeResult.expected || examples[activeTestCase]?.expectedOutput || "—"}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Your Output</p>
                    {activeResult.verdict === "WA" ? (
                      <DiffViewer expected={activeResult.expected ?? ""} actual={activeResult.stdout ?? ""} />
                    ) : activeResult.compileOutput ? (
                      <pre className="rounded-md border border-red-500/40 bg-red-950/20 p-3 font-mono text-xs text-red-200 whitespace-pre-wrap">
                        {activeResult.compileOutput}
                      </pre>
                    ) : activeResult.stderr ? (
                      <pre className="rounded-md border border-orange-500/40 bg-orange-950/20 p-3 font-mono text-xs text-orange-200 whitespace-pre-wrap">
                        {activeResult.stderr}
                      </pre>
                    ) : (
                      <pre className="rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                        {activeResult.stdout ?? "(no output)"}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Run your code to see test case results.</p>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      {/* ── Console tab ──────────────────────────────────────────── */}
      <TabsContent value="console" className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            {isRunning ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running on Judge0…
              </div>
            ) : isSubmitting && !submissionResult ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Judging submission…
              </div>
            ) : submissionResult ? (
              <SubmissionResultPanel result={submissionResult} />
            ) : consoleText ? (
              <pre className="whitespace-pre-wrap font-mono text-sm">{consoleText}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Terminal className="h-6 w-6" />
                Run your code to see output here
              </div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
