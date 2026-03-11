"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse, type Contest, ContestStatus } from "@repo/types";
import { formatDateTime, getContestStatusVariant } from "@/lib/utils";
import { Calendar, Users, Trophy } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { Role } from "@repo/types";

export default function ContestsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["contests", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      return api.get<ApiResponse<(Contest & { _count: { registrations: number; problems: number } })[]>>(`/api/contests?${params}`);
    },
  });

  const contests = data?.data ?? [];

  const statusBadgeVariant = (s: string): "live" | "upcoming" | "ended" | "outline" => {
    if (s === "LIVE") return "live";
    if (s === "UPCOMING") return "upcoming";
    return "ended";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contests</h1>
          <p className="text-muted-foreground">Compete and test your skills under pressure</p>
        </div>
        {(user?.role === Role.ADMIN || user?.role === Role.TEACHER) && (
          <Link href="/contests/create">
            <Button size="sm">Create Contest</Button>
          </Link>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["", "LIVE", "UPCOMING", "ENDED"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s || "All"}
          </Button>
        ))}
      </div>

      {/* Contest cards */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : contests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No contests found</div>
        ) : (
          contests.map((contest) => (
            <Link key={contest.id} href={`/contests/${contest.id}`}>
              <Card className="cursor-pointer hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{contest.title}</h3>
                        <Badge variant={statusBadgeVariant(contest.status)}>{contest.status}</Badge>
                        <Badge variant="outline" className="text-xs">{contest.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{contest.description.replace(/[#*`]/g, "").trim().slice(0, 150)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateTime(contest.startTime)} – {formatDateTime(contest.endTime)}</span>
                    <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{contest._count.problems} problems</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{contest._count.registrations} registered</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
