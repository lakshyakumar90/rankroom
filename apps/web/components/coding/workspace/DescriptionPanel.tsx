"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusChip } from "@repo/ui/common/StatusChip";
import { cn, formatMemory, formatRelativeTime, formatRuntime } from "@/lib/utils";
import { formatWrappedInput } from "@/lib/boilerplate";

interface ProblemTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
}

interface ProblemData {
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  scope?: "GLOBAL" | "DEPARTMENT" | "SECTION";
  createdBy?: { id: string; name: string } | null;
  constraints?: string | null;
  acceptanceRate: number;
  acceptedCount: number;
  totalCount: number;
  testCases: ProblemTestCase[];
  hints: string[];
  editorial?: {
    summary?: string | null;
    approach?: string | null;
    complexity?: string | null;
    fullEditorial: string;
  } | null;
  description: string;
}

interface ContestContext {
  points: number;
  hasAttempted: boolean;
  isRegistered: boolean;
  status: string;
}

export interface SubmissionHistoryItem {
  id: string;
  code: string;
  language: string;
  runtime?: number | null;
  memory?: number | null;
  createdAt: string;
  verdictLabel: "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "JUDGING";
}

const markdownComponents = {
  pre({ children, ...props }: { children?: React.ReactNode }) {
    return (
      <pre className="overflow-x-auto rounded-lg bg-muted p-4" {...props}>
        {children}
      </pre>
    );
  },
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    return (
      <code className={cn("font-mono text-sm", className)} {...props}>
        {children}
      </code>
    );
  },
};

interface DescriptionPanelProps {
  problem: ProblemData;
  history: SubmissionHistoryItem[];
  contestContext: ContestContext | null;
  activeLeftTab: "description" | "editorial" | "solutions" | "submissions" | "hints";
  onLeftTabChange: (value: "description" | "editorial" | "solutions" | "submissions" | "hints") => void;
  onOpenHistory: (item: SubmissionHistoryItem) => void;
}

export function DescriptionPanel({
  problem,
  history,
  contestContext,
  activeLeftTab,
  onLeftTabChange,
  onOpenHistory,
}: DescriptionPanelProps) {
  const examples = problem.testCases.filter((testCase) => testCase.isSample);

  return (
    <Tabs value={activeLeftTab} onValueChange={(value) => onLeftTabChange(value as typeof activeLeftTab)} className="h-full">
      <div className="border-b border-border px-4 pt-3">
        <TabsList className="bg-transparent p-0">
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="editorial">Editorial</TabsTrigger>
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

            {examples.map((example, index) => {
              // Try to pretty-print wrapped-problem JSON inputs
              const displayInput = formatWrappedInput(example.input);
              const isMultiLine = displayInput.includes("\n");
              return (
                <div key={example.id} className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Example {index + 1}</h3>
                  <div className="rounded-lg bg-muted p-3 font-mono text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Input</span>
                      {isMultiLine ? (
                        <pre className="mt-1 whitespace-pre-wrap text-sm">{displayInput}</pre>
                      ) : (
                        <p className="mt-0.5">{displayInput}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Output</span>
                      <p className="mt-0.5">{example.expectedOutput}</p>
                    </div>
                  </div>
                </div>
              );
            })}

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

      <TabsContent value="editorial" className="h-[calc(100%-3rem)]">
        <ScrollArea className="h-full px-6 py-5">
          {problem.editorial?.fullEditorial ? (
            <div className="space-y-4">
              {problem.editorial.summary ? (
                <p className="text-sm text-muted-foreground">{problem.editorial.summary}</p>
              ) : null}
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {problem.editorial.fullEditorial}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No editorial available yet.</p>
          )}
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
                onClick={() => onOpenHistory(submission)}
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
          <Accordion className="w-full">
            {problem.hints.map((hint, index) => (
              <AccordionItem key={index} value={`hint-${index}`}>
                <AccordionTrigger>{`Hint ${index + 1}`}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{hint}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : <p className="text-sm text-muted-foreground">No hints available yet.</p>}
      </TabsContent>
    </Tabs>
  );
}
