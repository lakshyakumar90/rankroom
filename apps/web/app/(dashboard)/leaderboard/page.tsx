"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse, type LeaderboardEntry } from "@repo/types";
import { formatPoints } from "@/lib/utils";
import { Trophy, Medal } from "lucide-react";
import { useAuthStore } from "@/store/auth";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"global" | "class" | "dept">("global");
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", tab],
    queryFn: () => api.get<ApiResponse<LeaderboardEntry[]>>("/api/leaderboard/global"),
  });

  const entries = data?.data ?? [];

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-amber-400" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-zinc-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
    return <span className="text-muted-foreground text-sm w-4 text-center">{rank}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground">Top coders ranked by points and problems solved</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["global", "class", "dept"] as const).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab(t)}
          >
            {t === "global" ? "Global" : t === "class" ? "My Class" : "Department"}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Points</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Solved</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">Contests</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden lg:table-cell">Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-6" /></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-4 w-32" /></div></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-8 ml-auto" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-8 ml-auto" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-24 ml-auto" /></td>
                </tr>
              ))
            ) : (
              entries.map((entry, idx) => {
                const rank = (entry.rank ?? idx + 1);
                const isCurrentUser = entry.userId === user?.id;
                return (
                  <tr
                    key={entry.userId}
                    className={`border-b border-border last:border-0 transition-colors ${isCurrentUser ? "bg-primary/5" : "hover:bg-muted/20"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">{rankIcon(rank)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={entry.user.avatar} name={entry.user.name} size="sm" />
                        <span className={`text-sm font-medium ${isCurrentUser ? "text-primary" : ""}`}>{entry.user.name}</span>
                        {isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPoints(entry.totalPoints)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{entry.problemsSolved}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{entry.contestsParticipated}</td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <div className="flex items-center justify-end gap-1 text-xs">
                        <span className="text-emerald-500">{entry.easySolved}E</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-amber-500">{entry.mediumSolved}M</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-red-500">{entry.hardSolved}H</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
