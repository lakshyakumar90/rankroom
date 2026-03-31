"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot, Sparkles, Loader2, AlertCircle, Clock4, Database,
  Zap, Terminal, X, ChevronRight, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { ApiResponse } from "@repo/types";
import { cn } from "@/lib/utils";

interface AiHintResult {
  optimalApproach?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  dryRun?: string;
  explanation?: string;
  issues?: string;
}

interface AiDrawerProps {
  open: boolean;
  onClose: () => void;
  problemId: string;
  problemTitle: string;
  problemDescription: string;
  code: string;
  language: string;
}

const markdownComponents = {
  pre({ children, ...props }: { children?: React.ReactNode }) {
    return (
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs" {...props}>
        {children}
      </pre>
    );
  },
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    return (
      <code className={cn("font-mono text-xs", className)} {...props}>
        {children}
      </code>
    );
  },
};

export function AiDrawer({
  open,
  onClose,
  problemId,
  problemTitle,
  problemDescription,
  code,
  language,
}: AiDrawerProps) {
  const [result, setResult] = useState<AiHintResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleAnalyze() {
    // Abort any previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setResult(null);
    setHasAnalyzed(true);

    try {
      const response = await api.post<ApiResponse<AiHintResult>>(
        `/api/problems/${problemId}/ai-hint`,
        { code, language, problemTitle, problemDescription }
      );
      setResult(response.data ?? null);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "AI analysis failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">AI Code Assistant</p>
              <p className="text-xs text-muted-foreground">Powered by OpenRouter</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {result && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => void handleAnalyze()}
                title="Re-analyze"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!hasAnalyzed && !loading && (
            <div className="flex flex-col items-center gap-5 py-16 text-center">
              <div className="flex size-20 items-center justify-center rounded-3xl bg-linear-to-br from-primary/20 to-primary/5">
                <Sparkles className="size-10 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-base font-semibold">Analyze your solution</p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                  Get optimal complexity analysis, step-by-step dry run,
                  and improvement suggestions for your current code.
                </p>
              </div>
              <div className="grid w-full gap-2 text-left">
                {[
                  { icon: Clock4, label: "Time & Space Complexity" },
                  { icon: Zap, label: "Optimal Approach" },
                  { icon: Terminal, label: "Step-by-step Dry Run" },
                  { icon: AlertCircle, label: "Issue Detection" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                    <Icon className="size-4 text-muted-foreground" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <Loader2 className="size-4 animate-spin text-primary" />
                <p className="text-sm text-primary">Analyzing your code with AI…</p>
              </div>
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/20">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Analysis failed</p>
                <p className="mt-0.5 text-xs text-red-600 dark:text-red-500">{error}</p>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* Complexity cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock4 className="size-3.5 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Time</span>
                  </div>
                  <p className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                    {result.timeComplexity ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-purple-200/70 bg-purple-50/50 p-3 dark:border-purple-900/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="size-3.5 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Space</span>
                  </div>
                  <p className="font-mono text-sm font-bold text-purple-600 dark:text-purple-400">
                    {result.spaceComplexity ?? "—"}
                  </p>
                </div>
              </div>

              {/* Optimal Approach */}
              {result.optimalApproach && (
                <Section
                  icon={<Zap className="size-3.5 text-emerald-500" />}
                  title="Optimal Approach"
                  className="border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  titleClass="text-emerald-700 dark:text-emerald-400"
                >
                  <p className="text-sm leading-relaxed">{result.optimalApproach}</p>
                </Section>
              )}

              {/* Explanation */}
              {result.explanation && (
                <Section
                  icon={<Bot className="size-3.5 text-primary" />}
                  title="Explanation"
                  className="border-border bg-muted/30"
                  titleClass=""
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {result.explanation}
                    </ReactMarkdown>
                  </div>
                </Section>
              )}

              {/* Dry Run */}
              {result.dryRun && (
                <Section
                  icon={<Terminal className="size-3.5 text-amber-500" />}
                  title="Dry Run"
                  className="border-amber-200/70 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
                  titleClass="text-amber-700 dark:text-amber-400"
                >
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {result.dryRun}
                  </pre>
                </Section>
              )}

              {/* Issues */}
              {result.issues && (
                <Section
                  icon={<AlertCircle className="size-3.5 text-red-500" />}
                  title="Issues Found"
                  className="border-red-200/70 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
                  titleClass="text-red-700 dark:text-red-400"
                >
                  <p className="text-sm leading-relaxed">{result.issues}</p>
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-border px-5 py-4">
          <Button
            className="w-full gap-2"
            onClick={() => void handleAnalyze()}
            disabled={loading || !code.trim()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : result ? (
              <RefreshCw className="size-4" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading ? "Analyzing…" : result ? "Re-analyze Code" : "Analyze My Code"}
          </Button>
          {!code.trim() && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Write some code first to analyze</p>
          )}
        </div>
      </div>
    </>
  );
}

function Section({
  icon,
  title,
  titleClass,
  className,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  titleClass: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-4 space-y-2.5", className)}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className={cn("text-sm font-semibold", titleClass)}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
