"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { type ApiResponse, type Problem, type Submission, SubmissionStatus, SUPPORTED_LANGUAGES } from "@repo/types";
import { getDifficultyColor, getStatusColor, formatRuntime, formatMemory } from "@/lib/utils";
import { Play, Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { createClient } from "@/lib/supabase/client";
import { CodeEditor } from "@repo/ui/code-editor";

interface ProblemDetail extends Problem {
  testCases: { id: string; input: string; expectedOutput: string; isSample: boolean }[];
  createdBy: { id: string; name: string };
  _count: { submissions: number };
}

interface RunResult {
  stdout: string;
  stderr: string;
  status: string;
  runtime?: number;
  memory?: number;
  testCase?: { input: string; expectedOutput: string };
}

export default function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuthStore();
  const [code, setCode] = useState("# Write your solution here\n\n");
  const [language, setLanguage] = useState("python");
  const [customInput, setCustomInput] = useState("");
  const [runResults, setRunResults] = useState<RunResult[] | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<Submission | null>(null);
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");

  const { data, isLoading } = useQuery({
    queryKey: ["problem", slug],
    queryFn: () => api.get<ApiResponse<ProblemDetail>>(`/api/problems/${slug}`),
  });

  const { data: submissionsData } = useQuery({
    queryKey: ["problem-submissions", data?.data?.id],
    queryFn: () => api.get<ApiResponse<Submission[]>>(`/api/problems/${data!.data!.id}/submissions`),
    enabled: !!data?.data?.id && activeTab === "submissions",
  });

  const problem = data?.data;

  const runMutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<RunResult[]>>("/api/execute/run", {
        problemId: problem!.id,
        code,
        language,
        customInput: customInput || undefined,
      }),
    onSuccess: (res) => {
      setRunResults(res.data ?? null);
    },
    onError: () => toast.error("Failed to run code"),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<{ submissionId: string; status: string }>>("/api/execute/submit", {
        problemId: problem!.id,
        code,
        language,
      }),
    onSuccess: async (res) => {
      if (!res.data) return;
      toast.info("Submission queued, waiting for verdict...");

      // Poll for result
      const submissionId = res.data.submissionId;
      const poll = async () => {
        const result = await api.get<ApiResponse<Submission>>(`/api/execute/submission/${submissionId}`);
        if (result.data?.status === SubmissionStatus.PENDING) {
          setTimeout(poll, 2000);
        } else {
          setSubmissionStatus(result.data ?? null);
          if (result.data?.status === SubmissionStatus.ACCEPTED) {
            toast.success("Accepted! 🎉");
          } else {
            toast.error(`${result.data?.status?.replace(/_/g, " ")}`);
          }
        }
      };
      setTimeout(poll, 2000);
    },
    onError: () => toast.error("Submission failed"),
  });

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] gap-4">
        <div className="flex-1 space-y-4 p-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="w-1/2 bg-zinc-950 rounded-lg" />
      </div>
    );
  }

  if (!problem) return <div className="p-6 text-muted-foreground">Problem not found</div>;

  const diffBadgeVariant = problem.difficulty === "EASY" ? "easy" : problem.difficulty === "MEDIUM" ? "medium" : "hard";

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)]">
      {/* Left: Problem description */}
      <div className="w-[45%] overflow-y-auto border-r border-border">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "description" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
              onClick={() => setActiveTab("description")}
            >
              Description
            </button>
            <button
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "submissions" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
              onClick={() => setActiveTab("submissions")}
            >
              Submissions
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "description" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{problem.title}</h1>
                  <Badge variant={diffBadgeVariant} className="capitalize">{problem.difficulty.charAt(0) + problem.difficulty.slice(1).toLowerCase()}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{problem._count.submissions} submissions</span>
                  <span>•</span>
                  <span>{problem.points} pts</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {problem.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>

              {/* Description - rendered as pre-formatted text since no markdown renderer */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{problem.description}</pre>
              </div>

              {problem.testCases.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Examples</h3>
                  {problem.testCases.filter((tc) => tc.isSample).slice(0, 3).map((tc, i) => (
                    <div key={tc.id} className="rounded-lg border border-border p-4 space-y-2 bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground">Example {i + 1}</p>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Input:</p>
                        <code className="block rounded bg-muted px-3 py-2 text-xs font-mono">{tc.input}</code>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Output:</p>
                        <code className="block rounded bg-muted px-3 py-2 text-xs font-mono">{tc.expectedOutput}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {problem.constraints && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Constraints</h3>
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">{problem.constraints}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {submissionsData?.data?.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <p className={`text-sm font-medium ${getStatusColor(sub.status)}`}>{sub.status.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{sub.language} • {new Date(sub.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{formatRuntime(sub.runtime)}</p>
                    <p>{formatMemory(sub.memory)}</p>
                  </div>
                </div>
              ))}
              {!submissionsData?.data?.length && (
                <p className="text-center text-sm text-muted-foreground py-8">No submissions yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Code editor */}
      <div className="flex flex-1 flex-col bg-zinc-950">
        {/* Editor toolbar */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run
            </Button>
            <Button
              size="sm"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || submissionStatus?.status === SubmissionStatus.PENDING}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit
            </Button>
          </div>
        </div>

        {/* Code Editor */}
        <CodeEditor
          value={code}
          onChange={setCode}
          className="flex-1 rounded-none border-0"
          minHeight={0}
          placeholder="Write your solution here..."
        />

        {/* Test input / results panel */}
        <div className="max-h-64 overflow-y-auto border-t border-zinc-800">
          <div className="flex border-b border-zinc-800">
            <button className="px-4 py-2 text-sm text-zinc-400">Custom Input</button>
            {runResults && <button className="px-4 py-2 text-sm text-zinc-400">Output</button>}
          </div>
          <div className="p-4">
            {!runResults ? (
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="h-20 w-full resize-none bg-transparent font-mono text-sm text-zinc-300 focus:outline-none"
                placeholder="Enter custom input (leave empty to run sample tests)..."
              />
            ) : (
              <div className="space-y-3">
                {runResults.map((r, i) => (
                  <div key={i} className="space-y-1">
                    <p className={`text-xs font-medium ${r.status === "Accepted" ? "text-emerald-400" : "text-red-400"}`}>{r.status}</p>
                    {r.stdout && <code className="block text-xs font-mono text-zinc-300">Output: {r.stdout}</code>}
                    {r.stderr && <code className="block text-xs font-mono text-red-400">Error: {r.stderr}</code>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submission result */}
        {submissionStatus && (
          <div className={`border-t border-zinc-800 px-4 py-3 flex items-center gap-3 ${submissionStatus.status === "ACCEPTED" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
            {submissionStatus.status === "ACCEPTED" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${submissionStatus.status === "ACCEPTED" ? "text-emerald-400" : "text-red-400"}`}>
                {submissionStatus.status.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-zinc-400">
                {formatRuntime(submissionStatus.runtime)} • {formatMemory(submissionStatus.memory)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
