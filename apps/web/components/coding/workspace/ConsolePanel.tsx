"use client";

import { ChevronDown, Loader2, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SubmissionResultPanel } from "@/components/coding/SubmissionResultPanel";
import type { SubmissionResult } from "@repo/types";

interface ConsolePanelProps {
  isRunning: boolean;
  isSubmitting: boolean;
  submissionResult: SubmissionResult | null;
  consoleText: string;
  isConsoleCollapsed: boolean;
  onToggleCollapsed: () => void;
  onClearConsole: () => void;
}

export function ConsolePanel({
  isRunning,
  isSubmitting,
  submissionResult,
  consoleText,
  isConsoleCollapsed,
  onToggleCollapsed,
  onClearConsole,
}: ConsolePanelProps) {
  return (
    <div className="relative flex h-full flex-col border-t border-border bg-card">
      {isRunning && <div className="absolute left-0 top-0 h-0.5 w-full animate-pulse bg-primary" />}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium"><Terminal className="h-4 w-4" />Console</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onClearConsole}><Trash2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onToggleCollapsed}>
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
  );
}
