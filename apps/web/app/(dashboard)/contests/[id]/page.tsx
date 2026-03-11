"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse, type Contest, ContestStatus } from "@repo/types";
import { formatDateTime } from "@/lib/utils";
import { Calendar, Clock, Trophy, Users, BookOpen, BarChart3, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";

interface ContestDetail extends Contest {
  createdBy: { id: string; name: string };
  _count: { registrations: number; problems: number };
  isRegistered: boolean;
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
    if (s === "LIVE") return "live";
    if (s === "UPCOMING") return "upcoming";
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
  const isLive = contest.status === ContestStatus.LIVE;
  const isUpcoming = contest.status === ContestStatus.UPCOMING;
  const isEnded = contest.status === ContestStatus.ENDED;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{contest.title}</h1>
          <Badge variant={statusVariant(contest.status)}>{contest.status}</Badge>
          <Badge variant="outline">{contest.type}</Badge>
        </div>
        <p className="text-muted-foreground leading-relaxed">{contest.description}</p>
        <p className="text-sm text-muted-foreground">
          Created by {contest.createdBy.name}
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
            <p className="text-2xl font-bold">{contest._count.problems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs">Registered</span>
            </div>
            <p className="text-2xl font-bold">{contest._count.registrations}</p>
          </CardContent>
        </Card>
      </div>

      {/* Register / Action */}
      {user && !isEnded && (
        <div className="flex items-center gap-3">
          {contest.isRegistered ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              Registered
            </div>
          ) : (
            <Button
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? "Registering…" : "Register Now"}
            </Button>
          )}

          {isLive && contest.isRegistered && (
            <Link href={`/contests/${id}/problems`}>
              <Button variant="outline">
                <BookOpen className="h-4 w-4 mr-2" />
                View Problems
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Navigation links for live/ended */}
      {(isLive || isEnded) && (
        <div className="flex flex-wrap gap-3">
          {(contest.isRegistered || isEnded) && (
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
