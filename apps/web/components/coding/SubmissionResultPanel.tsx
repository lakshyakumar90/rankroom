"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { StatusChip } from "@repo/ui/common/StatusChip";
import type { SubmissionResult } from "@repo/types";
import { DiffViewer } from "./DiffViewer";
import { cn, formatMemory, formatRuntime } from "@/lib/utils";

export function SubmissionResultPanel({ result }: { result: SubmissionResult }) {
  const firstFailingCase = useMemo(() => result.testResults.find((test) => !test.passed) ?? result.testResults[0], [result.testResults]);
  const [expanded, setExpanded] = useState(true);
  const passedCount = result.testResults.filter((test) => test.passed).length;

  return (
    <div className="grid gap-4">
      <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4">
        {result.verdict === "AC" ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 12 }).map((_, index) => (
              <span
                key={index}
                className="animate-verdict-confetti absolute top-0 h-3 w-1 rounded-full bg-primary/70"
                style={{
                  left: `${8 + index * 7}%`,
                  animationDelay: `${index * 120}ms`,
                }}
              />
            ))}
          </div>
        ) : null}
        <div className="flex flex-col items-center gap-3">
          <StatusChip verdict={result.verdict} size="lg" />
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>Runtime: {formatRuntime(result.runtime)}</span>
            <span>Memory: {formatMemory(result.memory)}</span>
            <span>Runtime Percentile: Coming soon</span>
            <span>Memory Percentile: Coming soon</span>
          </div>
          <p className="text-sm text-muted-foreground">Passed {passedCount}/{result.testResults.length}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {result.testResults.map((test) => (
              <span
                key={test.caseIndex}
                className={cn("h-3 w-3 rounded-full", test.passed ? "bg-green-400" : "bg-red-400")}
              />
            ))}
          </div>
        </div>
      </div>

      {firstFailingCase && (
        <div className="rounded-lg border border-border bg-card">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
            onClick={() => setExpanded((current) => !current)}
          >
            <span>Case {firstFailingCase.caseIndex + 1} details</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
          {expanded && (
            <div className="grid gap-3 border-t border-border px-4 py-4">
              {firstFailingCase.compileOutput ? (
                <pre className="overflow-x-auto rounded-md border border-red-500/40 bg-red-950/20 p-3 text-xs text-red-200">{firstFailingCase.compileOutput}</pre>
              ) : (
                <>
                  <div className="grid gap-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expected vs Actual</p>
                    <DiffViewer expected={firstFailingCase.expected ?? ""} actual={firstFailingCase.stdout ?? ""} />
                  </div>
                  {firstFailingCase.stderr ? (
                    <div className="grid gap-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">stderr</p>
                      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{firstFailingCase.stderr}</pre>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
