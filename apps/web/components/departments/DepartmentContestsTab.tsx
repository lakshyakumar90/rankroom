"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ApiResponse } from "@repo/types";
import { EmptyState } from "@/components/common/page-shell";

type ContestStatus = "UPCOMING" | "REGISTRATION_OPEN" | "LIVE" | "ENDED" | "RESULTS_PUBLISHED";

interface Contest {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: ContestStatus;
  _count: { registrations: number; problems: number };
}

const statusVariant: Record<ContestStatus, "default" | "secondary" | "destructive" | "outline"> = {
  UPCOMING: "secondary",
  REGISTRATION_OPEN: "outline",
  LIVE: "default",
  ENDED: "outline",
  RESULTS_PUBLISHED: "secondary",
};

export function DepartmentContestsTab({ departmentId }: { departmentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["department", "contests", departmentId],
    queryFn: () => api.get<ApiResponse<Contest[]>>(`/api/departments/${departmentId}/contests`),
    enabled: !!departmentId,
  });

  const contests = data?.data ?? [];

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  }

  if (contests.length === 0) {
    return (
      <EmptyState
        title="No contests"
        description="Contests for this department will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Title</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Start</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Registrations</th>
            <th className="sr-only">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contests.map((contest) => (
            <tr key={contest.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Trophy className="size-4 text-primary" />
                  <span className="text-sm font-medium">{contest.title}</span>
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(contest.startTime), { addSuffix: true })}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[contest.status]} className="capitalize text-xs">
                  {contest.status.replace(/_/g, " ").toLowerCase()}
                </Badge>
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-sm">
                {contest._count.registrations}
              </td>
              <td className="px-4 py-3">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/contests/${contest.id}`}>
                    View <ArrowRight className="ml-1 size-3" />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
