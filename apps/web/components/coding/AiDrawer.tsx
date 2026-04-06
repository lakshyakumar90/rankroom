"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot, Sparkles, Loader2, AlertCircle, Clock4, Database,
  Zap, Terminal, X, RefreshCw, Copy, Check, Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  solutionCode?: string;
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
      <pre className="overflow-x-auto rounded-xl border border-border bg-muted p-4 text-xs" {...props}>
        {children}
      </pre>
    );
  },
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    return (
      <code className={cn("font-mono text-xs text-foreground", className)} {...props}>
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
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleAnalyze() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setResult(null);
    setHasAnalyzed(true);

    try {
      const response = await api.post<ApiResponse<AiHintResult>>(
        "/api/ai/assist",
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

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l border-border bg-card/95 text-card-foreground shadow-2xl backdrop-blur transition-transform duration-500 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">AI Architect</p>
              <div className="flex items-center gap-1.5">
                <div className="size-1.5 animate-pulse rounded-full bg-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">System Online</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                onClick={() => void handleAnalyze()}
                title="Re-analyze"
              >
                <RefreshCw className="size-4 text-muted-foreground" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={onClose}>
              <X className="size-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {!hasAnalyzed && !loading && (
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/15 blur-3xl" />
                <div className="relative flex size-24 items-center justify-center rounded-[2.5rem] border border-primary/20 bg-primary/10 shadow-2xl">
                  <Sparkles className="size-12 text-primary" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xl font-bold leading-tight">Elevate Your Solution</p>
                <p className="mx-auto max-w-70 text-sm leading-relaxed text-muted-foreground">
                  Unlock enterprise-grade insights, optimal complexity patterns, and a step-by-step architectural breakdown.
                </p>
              </div>
              <div className="grid w-full gap-3 text-left">
                {[
                  { icon: Clock4, label: "Efficiency Analysis" },
                  { icon: Zap, label: "Optimal Architecture" },
                  { icon: Code2, label: "Refactored Implementation" },
                  { icon: AlertCircle, label: "Edge Case Detection" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="group flex items-center gap-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm transition-all hover:bg-muted/70">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-card transition-transform group-hover:scale-110">
                      <Icon className="size-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <span className="font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4">
                <Loader2 className="size-5 animate-spin text-primary" />
                <p className="text-sm font-semibold text-primary">Synthesizing architectural insights...</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/20">
                <AlertCircle className="size-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-bold text-destructive">Request Interference</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-destructive/80">{error}</p>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Complexity cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="group rounded-2xl border border-primary/20 bg-primary/10 p-4 transition-all hover:bg-primary/15">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-card">
                      <Clock4 className="size-4 text-primary" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Time</span>
                  </div>
                  <p className="origin-left font-mono text-base font-black transition-transform group-hover:scale-105">
                    {result.timeComplexity ?? "—"}
                  </p>
                </div>
                <div className="group rounded-2xl border border-accent bg-accent/45 p-4 transition-all hover:bg-accent/60">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-card">
                      <Database className="size-4 text-accent-foreground" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Space</span>
                  </div>
                  <p className="origin-left font-mono text-base font-black transition-transform group-hover:scale-105">
                    {result.spaceComplexity ?? "—"}
                  </p>
                </div>
              </div>

              {/* Solution Code Section */}
              {result.solutionCode && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2.5">
                      <Code2 className="size-4 text-primary" />
                      <h3 className="text-sm font-bold uppercase tracking-wider">Suggested Implementation</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 rounded-lg border border-border bg-muted px-2.5 text-[11px] font-bold text-muted-foreground"
                      onClick={() => handleCopy(result.solutionCode!)}
                    >
                      {copied ? (
                        <>
                          <Check className="size-3 text-emerald-400" />
                          <span className="text-emerald-400 uppercase">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span className="uppercase">Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/70 prose-pre:m-0 prose-code:p-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {"```" + language.toLowerCase() + "\n" + result.solutionCode + "\n```"}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Optimal Approach */}
              {result.optimalApproach && (
                <Section
                  icon={<Zap className="size-4 text-primary" />}
                  title="Architecture"
                  className="border-primary/20 bg-primary/10"
                  titleClass="text-primary"
                >
                  <p className="text-sm font-medium leading-relaxed text-muted-foreground">{result.optimalApproach}</p>
                </Section>
              )}

              {/* Explanation */}
              {result.explanation && (
                <Section
                  icon={<Bot className="size-4 text-accent-foreground" />}
                  title="Breakdown"
                  className="border-border bg-muted/40"
                  titleClass="text-accent-foreground"
                >
                  <div className="prose prose-sm max-w-none leading-relaxed text-muted-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {result.explanation}
                    </ReactMarkdown>
                  </div>
                </Section>
              )}

              {/* Dry Run */}
              {result.dryRun && (
                <Section
                  icon={<Terminal className="size-4 text-accent-foreground" />}
                  title="Execution Trace"
                  className="border-accent bg-accent/45"
                  titleClass="text-accent-foreground"
                >
                  <div className="rounded-xl border border-border bg-card p-3.5">
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed tracking-tight text-foreground">
                      {result.dryRun}
                    </pre>
                  </div>
                </Section>
              )}

              {/* Issues */}
              {result.issues && result.issues.length > 0 && (
                <Section
                  icon={<AlertCircle className="size-4 text-destructive" />}
                  title="Vulnerabilities"
                  className="border-destructive/30 bg-destructive/10"
                  titleClass="text-destructive"
                >
                  <p className="text-sm font-medium leading-relaxed text-muted-foreground underline decoration-destructive/30 decoration-2 underline-offset-4">{result.issues}</p>
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-border bg-card px-6 py-5">
          <Button
            className="h-11 w-full gap-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            onClick={() => void handleAnalyze()}
            disabled={loading || !code.trim()}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : result ? (
              <RefreshCw className="size-4" />
            ) : (
              <Sparkles className="size-5" />
            )}
            {loading ? "Synthesizing..." : result ? "Re-architect Solution" : "Initiate AI Analysis"}
          </Button>
          {!code.trim() && (
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Provide implementation to proceed</p>
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
    <div className={cn("space-y-4 rounded-2xl border p-5 shadow-xs", className)}>
      <div className="flex items-center gap-3">
        <div className="flex size-7 items-center justify-center rounded-lg border border-border bg-card">
          {icon}
        </div>
        <h3 className={cn("text-xs font-black uppercase tracking-widest", titleClass)}>{title}</h3>
      </div>
      <div className="px-1">{children}</div>
    </div>
  );
}
