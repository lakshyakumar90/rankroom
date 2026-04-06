"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse, ContestStatus } from "@repo/types";
import { formatDateTime } from "@/lib/utils";
import { Calendar, Clock, Trophy, Users, BookOpen, BarChart3, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";

interface RegistrationState {
  status: "NOT_REGISTERED" | "REGISTERED" | "PENDING" | "WITHDRAWN" | "WAITLISTED" | "REJECTED";
  canRegister?: boolean;
  reason?: string | null;
}

interface ContestDetail {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  type: string;
  startTime: string;
  endTime: string;
  registrationEnd?: string | null;
  rules?: string | null;
  maxParticipants?: number | null;
  createdBy: { id: string; name: string };
  _count?: { registrations: number; problems: number };
  problems?: { problem: { id: string; title: string; difficulty: string; points: number } }[];
  isRegistered?: boolean;
  viewerState?: {
    registrationState: RegistrationState;
    isStaff: boolean;
    ownStanding?: { totalScore: number; rank: number; solvedCount: number; acceptedCount?: number; wrongCount?: number } | null;
  };
  registrations?: { user: { id: string; name: string; email: string } }[];
}

function CountdownTimer({ target }: { target: Date }) {
  const now = Date.now();
  const diff = target.getTime() - now;
  if (diff <= 0) return <span className="font-mono text-muted-foreground">–</span>;

  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);

  return (
    <span className="font-mono text-lg font-semibold tabular-nums">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

export default function ContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["contest", id],
    queryFn: () => api.get<ApiResponse<ContestDetail>>(`/api/contests/${id}`),
    refetchInterval: 30_000,
  });

  const registerMutation = useMutation({
    mutationFn: () => api.post(`/api/contests/${id}/register`, {}),
    onSuccess: () => {
      toast.success("Registered successfully!");
      queryClient.invalidateQueries({ queryKey: ["contest", id] });
    },
    onError: (e: Error) => toast.error(e.message || "Registration failed"),
  });

  const contest = data?.data;

  const statusVariant = (s: string): "live" | "upcoming" | "ended" | "outline" => {
    if (s === "LIVE" || s === "ONGOING") return "live";
    if (s === "UPCOMING" || s === "SCHEDULED" || s === "REGISTRATION_OPEN") return "upcoming";
    return "ended";
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (!contest) {
    return <div className="py-16 text-center text-muted-foreground">Contest not found</div>;
  }

  const startTime = new Date(contest.startTime);
  const endTime = new Date(contest.endTime);
  const isLive = contest.status === ContestStatus.LIVE || contest.status === "ONGOING";
  const isUpcoming = ["UPCOMING", "SCHEDULED", "REGISTRATION_OPEN"].includes(contest.status);
  const isEnded = ["ENDED", "COMPLETED", "ARCHIVED"].includes(contest.status);

  // Derive registration state from either top-level flag or viewerState
  const regState = contest.viewerState?.registrationState;
  const isRegistered = contest.isRegistered === true || regState?.status === "REGISTERED";
  const isPending = regState?.status === "PENDING";
  const isWaitlisted = regState?.status === "WAITLISTED";
  const canRegister = regState?.status === "NOT_REGISTERED" && (regState.canRegister ?? true);
  const regClosedReason = regState?.status === "NOT_REGISTERED" && !regState.canRegister ? regState.reason : null;

  // Counts — support both _count object and derived from arrays
  const problemCount = contest._count?.problems ?? contest.problems?.length ?? 0;
  const registrationCount = contest._count?.registrations ?? contest.registrations?.length ?? 0;

  const isStaff = contest.viewerState?.isStaff ?? false;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{contest.title}</h1>
          <Badge variant={statusVariant(contest.status)}>{contest.status.replace("_", " ")}</Badge>
          <Badge variant="outline">{contest.type}</Badge>
        </div>
        {contest.description && (
          <p className="text-muted-foreground leading-relaxed">{contest.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Created by {contest.createdBy?.name ?? "Unknown"}
        </p>
      </div>

      {/* Countdown (only show if live or upcoming) */}
      {(isLive || isUpcoming) && (
        <Card className={isLive ? "border-emerald-500/30 bg-emerald-500/5" : "border-primary/20 bg-primary/5"}>
          <CardContent className="flex items-center gap-4 p-5">
            <Clock className={`h-5 w-5 shrink-0 ${isLive ? "text-emerald-500" : "text-primary"}`} />
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {isLive ? "Contest ends in" : "Contest starts in"}
              </p>
              <CountdownTimer target={isLive ? endTime : startTime} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Timeline</span>
            </div>
            <p className="text-sm font-medium">{formatDateTime(contest.startTime)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">to {formatDateTime(contest.endTime)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy className="h-4 w-4" />
              <span className="text-xs">Problems</span>
            </div>
            <p className="text-2xl font-bold">{problemCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs">Registered</span>
            </div>
            <p className="text-2xl font-bold">{registrationCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Own standing (if student has participated) */}
      {contest.viewerState?.ownStanding && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-6 p-5">
            <div>
              <p className="text-xs text-muted-foreground">Your Rank</p>
              <p className="text-2xl font-bold">#{contest.viewerState.ownStanding.rank}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="text-2xl font-bold">{contest.viewerState.ownStanding.totalScore}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Solved</p>
              <p className="text-2xl font-bold">{contest.viewerState.ownStanding.solvedCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Accepted</p>
              <p className="text-2xl font-bold">{contest.viewerState.ownStanding.acceptedCount ?? contest.viewerState.ownStanding.solvedCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wrong</p>
              <p className="text-2xl font-bold">{contest.viewerState.ownStanding.wrongCount ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration closed reason */}
      {regClosedReason && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {regClosedReason}
        </div>
      )}

      {/* Register / Action */}
      {user && user.role === "STUDENT" && !isEnded && (
        <div className="flex items-center gap-3">
          {isRegistered ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              Registered
            </div>
          ) : isPending ? (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-500">
              <Clock className="h-4 w-4" />
              Registration Pending
            </div>
          ) : isWaitlisted ? (
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-500">
              <Users className="h-4 w-4" />
              Waitlisted
            </div>
          ) : canRegister ? (
            <Button
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? "Registering…" : "Register Now"}
            </Button>
          ) : null}

          {isLive && (isRegistered || isStaff) && (
            <Link href={`/contests/${id}/problems`}>
              <Button variant="outline">
                <BookOpen className="h-4 w-4 mr-2" />
                View Problems
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Staff: registrations list */}
      {isStaff && contest.registrations && contest.registrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Registered Participants ({contest.registrations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {contest.registrations.map((r) => (
                <div key={r.user.id} className="flex items-center justify-between py-1 text-sm border-b border-border/50 last:border-0">
                  <span>{r.user.name}</span>
                  <span className="text-muted-foreground text-xs">{r.user.email}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation links for live/ended */}
      {(isLive || isEnded) && (
        <div className="flex flex-wrap gap-3">
          {(isRegistered || isStaff || isEnded) && (
            <Link href={`/contests/${id}/problems`}>
              <Button variant="outline" size="sm">
                <BookOpen className="h-4 w-4 mr-1" />
                {isEnded ? "Problem Set" : "Problems"}
              </Button>
            </Link>
          )}
          <Link href={`/contests/${id}/standings`}>
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4 mr-1" />
              {isEnded ? "Final Standings" : "Live Standings"}
            </Button>
          </Link>
        </div>
      )}

      {/* Rules */}
      {contest.rules && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans">{contest.rules}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
