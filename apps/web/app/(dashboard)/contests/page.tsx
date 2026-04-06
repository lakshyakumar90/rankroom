"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse, type Contest } from "@repo/types";
import { formatDateTime } from "@/lib/utils";
import { Calendar, Users, Trophy, Plus, Clock, CheckCircle, Zap, Lock } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { hasPermission } from "@/lib/permissions";
import { toast } from "sonner";

type RegistrationState =
  | { status: "NOT_REGISTERED"; canRegister: boolean; reason?: string }
  | { status: "REGISTERED"; teamId?: string | null }
  | { status: "PENDING"; teamId?: string | null }
  | { status: "WITHDRAWN" }
  | { status: "WAITLISTED" }
  | { status: "REJECTED"; reason?: string | null };

type ContestWithMeta = Contest & {
  _count: { registrations: number; problems: number };
  // Legacy field - kept for backward compat
  isRegistered?: boolean;
  // New canonical field from server
  registrationState?: RegistrationState | null;
  createdBy?: { id: string; name: string };
};

// ─── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(target: Date | null) {
  const [diff, setDiff] = useState<number>(() => target ? target.getTime() - Date.now() : 0);

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target || diff <= 0) return null;

  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${secs}s`;
}

function CountdownBadge({ contest }: { contest: ContestWithMeta }) {
  const target = contest.status === "UPCOMING"
    ? new Date(contest.startTime)
    : contest.status === "LIVE"
      ? new Date(contest.endTime)
      : null;

  const countdown = useCountdown(target);
  if (!countdown) return null;

  return (
    <span className="flex items-center gap-1 text-xs font-mono">
      <Clock className="size-3" />
      {contest.status === "UPCOMING" ? "Starts in" : "Ends in"} {countdown}
    </span>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "LIVE") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-600">
        <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "UPCOMING") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
        <Zap className="size-3" />
        UPCOMING
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      ENDED
    </span>
  );
}

// ─── Registration button driven by canonical server state ────────────────────
function RegistrationButton({
  contest,
  canParticipate,
  isLiveOrUpcoming,
  isEnded,
  onRegister,
}: {
  contest: ContestWithMeta;
  canParticipate: boolean;
  isLiveOrUpcoming: boolean;
  isEnded: boolean;
  onRegister: (id: string) => void;
}) {
  // Prefer new canonical registrationState, fallback to legacy isRegistered
  const regState = contest.registrationState;

  if (!regState && contest.isRegistered) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
        <CheckCircle className="size-3" /> Registered
      </span>
    );
  }

  if (regState?.status === "REGISTERED") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
        <CheckCircle className="size-3" /> Registered
      </span>
    );
  }
  if (regState?.status === "PENDING") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-600">
        Awaiting approval
      </span>
    );
  }
  if (regState?.status === "WAITLISTED") {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Waitlisted</span>
    );
  }
  if (regState?.status === "WITHDRAWN" || regState?.status === "REJECTED") {
    return null;
  }

  if (canParticipate && isLiveOrUpcoming && (!regState || (regState.status === "NOT_REGISTERED" && regState.canRegister))) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full h-7 text-xs px-3"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRegister(contest.id);
        }}
      >
        Register
      </Button>
    );
  }

  if (isEnded || (regState?.status === "NOT_REGISTERED" && !regState.canRegister)) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
        <Lock className="size-3" /> {regState?.reason ? regState.reason : "Closed"}
      </span>
    );
  }

  return null;
}

// ─── Contest Card ─────────────────────────────────────────────────────────────
function ContestCard({ contest, onRegister }: {
  contest: ContestWithMeta;
  onRegister: (id: string) => void;
}) {
  const { user } = useAuthStore();
  const canParticipate = hasPermission(user?.role, "contests:participate");
  const isLiveOrUpcoming = contest.status === "LIVE" || contest.status === "UPCOMING";
  const isEnded = contest.status === "ENDED";

  return (
    <Card className={`group transition-all hover:shadow-md hover:border-primary/30 h-full flex flex-col ${contest.status === "LIVE" ? "border-green-500/30 ring-1 ring-green-500/20" : ""}`}>
      <CardContent className="p-4 flex flex-col h-full gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={contest.status} />
          <Badge variant="outline" className="text-[10px]">{contest.type}</Badge>
        </div>
        <h3 className="text-sm font-semibold leading-snug break-words">{contest.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-auto flex-1">
          {contest.description.replace(/[#*`]/g, "").trim().slice(0, 160)}
        </p>

        {/* Registration state - driven by canonical server state */}
        <div className="flex items-center justify-between pt-2">
          <CountdownBadge contest={contest} />
          <RegistrationButton
            contest={contest}
            canParticipate={canParticipate}
            isLiveOrUpcoming={isLiveOrUpcoming}
            isEnded={isEnded}
            onRegister={onRegister}
          />
        </div>

        <div className="mt-2 flex flex-col gap-2 text-[10px] text-muted-foreground border-t border-border/60 pt-3">
          <div className="flex items-center gap-2 justify-between">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {new Date(contest.startTime).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {contest._count.registrations} registered
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ContestsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contests", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      return api.get<ApiResponse<ContestWithMeta[]>>(`/api/contests?${params}`);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (contestId: string) =>
      api.post<ApiResponse<unknown>>(`/api/contests/${contestId}/register`, {}),
    onSuccess: (_, contestId) => {
      toast.success("Successfully registered!");
      queryClient.setQueryData<ApiResponse<ContestWithMeta[]>>(
        ["contests", statusFilter],
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((c) =>
              c.id === contestId ? { ...c, isRegistered: true } : c
            ),
          };
        }
      );
    },
    onError: (error: Error) => toast.error(error.message || "Registration failed"),
  });

  const contests = data?.data ?? [];

  const filters: { label: string; value: string }[] = [
    { label: "All", value: "" },
    { label: "🔴 Live", value: "LIVE" },
    { label: "🔵 Upcoming", value: "UPCOMING" },
    { label: "Ended", value: "ENDED" },
  ];

  const liveContests = contests.filter((c) => c.status === "LIVE");
  const upcomingContests = contests.filter((c) => c.status === "UPCOMING");
  const endedContests = contests.filter((c) => c.status === "ENDED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contests</h1>
          <p className="text-muted-foreground">Compete and test your skills under pressure</p>
        </div>
        {hasPermission(user?.role, "contests:create") && (
          <Button asChild className="gap-2 rounded-xl">
            <Link href="/contests/create">
              <Plus className="size-4" />
              Create Contest
            </Link>
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filters.map(({ label, value }) => (
          <Button
            key={value}
            variant={statusFilter === value ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Contest list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="mb-2 h-5 w-48" />
                <Skeleton className="mb-4 h-4 w-full" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : contests.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Trophy className="mx-auto mb-3 size-12 opacity-20" />
          <p>No contests found</p>
        </div>
      ) : (
        <div className="flex items-stretch gap-6 h-full overflow-x-auto pb-4 snap-x">
          {/* Live Column */}
          {(statusFilter === "" || statusFilter === "LIVE") && (
            <div className="flex-1 min-w-[300px] max-w-[400px] bg-muted/20 border border-border/50 rounded-2xl p-4 flex flex-col snap-center">
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                  <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                  Live Now
                </h2>
                <Badge variant="secondary">{liveContests.length}</Badge>
              </div>
              <div className="space-y-4 flex-1">
                {liveContests.map((contest) => (
                  <Link key={contest.id} href={`/contests/${contest.id}`} className="block h-full">
                    <ContestCard contest={contest} onRegister={(id) => registerMutation.mutate(id)} />
                  </Link>
                ))}
                {liveContests.length === 0 && (
                  <div className="h-32 border-2 border-dashed border-border/50 rounded-xl flex items-center justify-center text-sm text-muted-foreground">
                    No active contests
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Column */}
          {(statusFilter === "" || statusFilter === "UPCOMING") && (
            <div className="flex-1 min-w-[300px] max-w-[400px] bg-muted/20 border border-border/50 rounded-2xl p-4 flex flex-col snap-center">
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                  <Zap className="size-4 text-primary" />
                  Upcoming
                </h2>
                <Badge variant="secondary">{upcomingContests.length}</Badge>
              </div>
              <div className="space-y-4 flex-1">
                {upcomingContests.map((contest) => (
                  <Link key={contest.id} href={`/contests/${contest.id}`} className="block h-full">
                    <ContestCard contest={contest} onRegister={(id) => registerMutation.mutate(id)} />
                  </Link>
                ))}
                {upcomingContests.length === 0 && (
                  <div className="h-32 border-2 border-dashed border-border/50 rounded-xl flex items-center justify-center text-sm text-muted-foreground">
                    No upcoming contests
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ended Column */}
          {(statusFilter === "" || statusFilter === "ENDED") && (
            <div className="flex-1 min-w-[300px] max-w-[400px] bg-muted/20 border border-border/50 rounded-2xl p-4 flex flex-col snap-center">
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <Lock className="size-4" />
                  Ended
                </h2>
                <Badge variant="secondary">{endedContests.length}</Badge>
              </div>
              <div className="space-y-4 flex-1">
                {endedContests.map((contest) => (
                  <Link key={contest.id} href={`/contests/${contest.id}`} className="block h-full">
                    <ContestCard contest={contest} onRegister={(id) => registerMutation.mutate(id)} />
                  </Link>
                ))}
                {endedContests.length === 0 && (
                  <div className="h-32 border-2 border-dashed border-border/50 rounded-xl flex items-center justify-center text-sm text-muted-foreground">
                    No past contests
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
