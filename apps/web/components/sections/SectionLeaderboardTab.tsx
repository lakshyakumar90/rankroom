"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import type { ApiResponse } from "@repo/types";
import { EmptyState } from "@/components/common/page-shell";

interface LeaderboardEntry {
  id: string;
  totalScore: number;
  codingScore: number;
  cgpaScore: number;
  rank?: number | null;
  student: { id: string; name: string; avatar?: string | null };
}

export function SectionLeaderboardTab({ sectionId }: { sectionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["section", sectionId, "leaderboard"],
    queryFn: () => api.get<ApiResponse<LeaderboardEntry[]>>(`/api/sections/${sectionId}/leaderboard`),
    enabled: !!sectionId,
  });

  const entries = data?.data ?? [];

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (entries.length === 0) return <EmptyState title="No leaderboard data" description="Scores will appear once computed." />;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-10 px-4 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Student</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">Coding</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">CGPA</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const rank = entry.rank ?? idx + 1;
            return (
              <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3">
                  <span className={rank <= 3 ? "font-bold text-primary" : "text-muted-foreground text-sm"}>
                    {rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={entry.student.avatar} name={entry.student.name} size="sm" />
                    <p className="text-sm font-medium">{entry.student.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell text-sm text-muted-foreground">
                  {entry.codingScore.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell text-sm text-muted-foreground">
                  {entry.cgpaScore.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                  {entry.totalScore.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
