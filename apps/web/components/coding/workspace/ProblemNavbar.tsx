"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Bot, ChevronLeft, ChevronRight, Loader2, Play, Settings2, Snowflake, Timer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface ContestContext {
  contestId?: string;
  points: number;
  hasAttempted: boolean;
  hasAccepted: boolean;
  isRegistered: boolean;
  status: "DRAFT" | "UPCOMING" | "SCHEDULED" | "REGISTRATION_OPEN" | "LIVE" | "FROZEN" | "ENDED" | "RESULTS_PUBLISHED";
  penaltyMinutes?: number;
  aiDisabled?: boolean;
}

export interface ProblemNavbarProps {
  contestId: string | null;
  problemId: string;
  problemTitle: string;
  problemDifficulty: "EASY" | "MEDIUM" | "HARD";
  currentIndex: number;
  previousProblemId: string | null;
  nextProblemId: string | null;
  contestContext: ContestContext | null;
  elapsedSeconds: number;
  timerStarted: boolean;
  isRunning: boolean;
  isSubmitting: boolean;
  submitDisabled: boolean;
  fontSize: number;
  onRun: () => void;
  onSubmit: () => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onOpenAi: () => void;
  onFontSizeChange: (size: number) => void;
}

export function ProblemNavbar({
  contestId,
  problemId,
  problemTitle,
  problemDifficulty,
  currentIndex,
  previousProblemId,
  nextProblemId,
  contestContext,
  elapsedSeconds,
  timerStarted,
  isRunning,
  isSubmitting,
  submitDisabled,
  fontSize,
  onRun,
  onSubmit,
  onToggleTimer,
  onResetTimer,
  onOpenAi,
  onFontSizeChange,
}: ProblemNavbarProps) {
  const tabSwitchCountRef = useRef(0);

  // Tab-switch detection during live contests
  useEffect(() => {
    if (!contestId || !contestContext || !["LIVE", "FROZEN"].includes(contestContext.status)) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        tabSwitchCountRef.current += 1;
        try {
          await api.post(`/api/contests/${contestId}/tab-switch`, {});
          if (tabSwitchCountRef.current >= 3) {
            toast.warning("Tab switch warning", {
              description: `You've switched tabs ${tabSwitchCountRef.current} times. This activity is being logged.`,
            });
          }
        } catch {
          // Silently ignore — logging best-effort
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [contestId, contestContext]);

  const isFrozen = contestContext?.status === "FROZEN";
  const isLive = contestContext?.status === "LIVE" || isFrozen;

  return (
    <div className="flex h-12 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3 text-sm">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">R</span>
        <div className="flex items-center gap-2">
          <Link href={contestId ? `/contests/${contestId}/problems` : "/problems"} className="text-muted-foreground">
            {contestId ? "Contest Problems" : "Problems"}
          </Link>
          <span className="text-muted-foreground">›</span>
          <span>{problemTitle}</span>
        </div>
        <Badge variant="outline" className="text-xs">{currentIndex >= 0 ? currentIndex + 1 : "--"}</Badge>
        {contestContext ? <Badge variant="secondary" className="text-xs">{contestContext.points} pts</Badge> : null}
        {isFrozen ? (
          <Badge variant="outline" className="gap-1 border-blue-400/40 bg-blue-400/10 text-xs text-blue-400">
            <Snowflake className="h-3 w-3" />
            Leaderboard Frozen
          </Badge>
        ) : null}
        {contestContext?.penaltyMinutes && isLive ? (
          <Badge variant="outline" className="border-yellow-400/40 bg-yellow-400/10 text-xs text-yellow-400">
            +{contestContext.penaltyMinutes}min penalty/WA
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" disabled={!previousProblemId} asChild>
          {previousProblemId ? (
            <Link href={`/problems/${previousProblemId}`}><ChevronLeft className="h-4 w-4" /></Link>
          ) : (
            <span><ChevronLeft className="h-4 w-4" /></span>
          )}
        </Button>
        <div className="max-w-xs truncate text-sm font-medium">{problemTitle}</div>
        <Button variant="ghost" size="icon" disabled={!nextProblemId} asChild>
          {nextProblemId ? (
            <Link href={`/problems/${nextProblemId}`}><ChevronRight className="h-4 w-4" /></Link>
          ) : (
            <span><ChevronRight className="h-4 w-4" /></span>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          className={cn(
            problemDifficulty === "EASY" && "bg-green-400/10 text-green-400",
            problemDifficulty === "MEDIUM" && "bg-yellow-400/10 text-yellow-400",
            problemDifficulty === "HARD" && "bg-red-400/10 text-red-400"
          )}
        >
          {problemDifficulty}
        </Badge>
        <div className="h-5 w-px bg-border" />
        <Button variant="ghost" size="sm" onClick={onToggleTimer}>
          <Timer className="mr-2 h-4 w-4" />
          {timerStarted ? "Pause" : "Start"} {new Date(elapsedSeconds * 1000).toISOString().slice(11, 19)}
        </Button>
        <Button variant="ghost" size="sm" onClick={onResetTimer}>Reset</Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><Settings2 className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {[12, 13, 14, 15, 16].map((size) => (
              <DropdownMenuItem key={size} onClick={() => onFontSizeChange(size)}>
                Font size {size}{size === fontSize ? " (current)" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-5 w-px bg-border max-sm:hidden" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenAi}
          title="AI Assistant"
          className="text-primary hover:bg-primary/10 hover:text-primary max-sm:hidden"
        >
          <Bot className="h-4 w-4" />
        </Button>

        <Button size="sm" className="bg-green-500 text-white hover:bg-green-600" onClick={onSubmit} disabled={submitDisabled || contestContext?.hasAccepted}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {contestContext?.hasAccepted ? "Solved" : "Submit"}
        </Button>
        <Button variant="outline" size="sm" onClick={onRun} disabled={isRunning}>
          {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Run
        </Button>
      </div>
    </div>
  );
}
