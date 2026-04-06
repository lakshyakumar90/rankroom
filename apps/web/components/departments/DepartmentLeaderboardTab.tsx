"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { ApiResponse } from "@repo/types";
import { EmptyState } from "@/components/common/page-shell";

interface LeaderboardEntry {
  id: string;
  totalScore: number;
  rank?: number | null;
  section: { id: string; name: string; code: string };
  student: {
    id: string;
    name: string;
    avatar?: string | null;
    studentProfile?: { cgpa?: number | null; leetcodeSolved?: number | null } | null;
  };
}

export function DepartmentLeaderboardTab({ departmentId }: { departmentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["department", "leaderboard", departmentId],
    queryFn: () => api.get<ApiResponse<LeaderboardEntry[]>>(`/api/departments/${departmentId}/leaderboard`),
    enabled: !!departmentId,
  });

  const entries = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No leaderboard data"
        description="Leaderboard scores will appear once computed."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-12 px-4 py-3 text-left text-xs font-medium text-muted-foreground">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Student</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Section</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">CGPA</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Score</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const rank = entry.rank ?? idx + 1;
            return (
              <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3">
                  <span
                    className={
                      rank === 1
                        ? "text-yellow-500 font-bold"
                        : rank === 2
                          ? "text-zinc-400 font-bold"
                          : rank === 3
                            ? "text-orange-500 font-bold"
                            : "text-muted-foreground"
                    }
                  >
                    #{rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={entry.student.avatar} name={entry.student.name} size="sm" />
                    <p className="text-sm font-medium">{entry.student.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Badge variant="outline" className="text-xs font-mono">{entry.section.code}</Badge>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">
                  {entry.student.studentProfile?.cgpa ?? "—"}
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
