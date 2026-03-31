"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse, type ContestStanding } from "@repo/types";
import { Trophy, Medal, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

export default function ContestStandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contest-standings", id],
    queryFn: () => api.get<ApiResponse<ContestStanding[]>>(`/api/contests/${id}/standings`),
    refetchInterval: 60_000,
  });

  const standings = data?.data ?? [];

  useEffect(() => {
    const socket = getSocket();
    const handleUpdate = (payload: { contestId: string; standings: ContestStanding[] }) => {
      if (payload.contestId !== id) return;
      queryClient.setQueryData(["contest-standings", id], { success: true, data: payload.standings });
    };

    socket.emit("contest:join", { contestId: id });
    socket.on("contest:standing_update", handleUpdate);

    return () => {
      socket.emit("contest:leave", { contestId: id });
      socket.off("contest:standing_update", handleUpdate);
    };
  }, [id, queryClient]);

  const rankIcon = (rank: number) => {
    if (rank === 1)
      return <Trophy className="h-4 w-4 text-amber-400" />;
    if (rank === 2)
      return <Medal className="h-4 w-4 text-zinc-400" />;
    if (rank === 3)
      return <Medal className="h-4 w-4 text-amber-600" />;
    return (
      <span className="text-muted-foreground text-sm w-4 text-center">
        {rank}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/contests/${id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Standings</h1>
          <p className="text-muted-foreground text-sm">
            {standings.length} participants • auto-refreshes every 30s
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                Participant
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                Score
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">
                Solved
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">
                Last Submit
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-6" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Skeleton className="h-4 w-8 ml-auto" />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Skeleton className="h-4 w-24 ml-auto" />
                  </td>
                </tr>
              ))
            ) : standings.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No standings yet. Be the first to submit!
                </td>
              </tr>
            ) : (
              standings.map((entry) => {
                const rank = entry.rank ?? 0;
                const isCurrentUser = entry.userId === user?.id;

                return (
                  <tr
                    key={entry.userId}
                    className={`border-b border-border last:border-0 transition-colors ${
                      isCurrentUser
                        ? "bg-primary/5"
                        : "hover:bg-muted/20"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        {rankIcon(rank)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={entry.user.avatar}
                          name={entry.user.name}
                          size="sm"
                        />
                        <span
                          className={`text-sm font-medium ${
                            isCurrentUser ? "text-primary" : ""
                          }`}
                        >
                          {entry.user.name}
                        </span>
                        {isCurrentUser && (
                          <Badge variant="secondary" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {entry.totalScore}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                      {entry.solvedCount}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                      {entry.lastSubmitTime
                        ? new Date(entry.lastSubmitTime).toLocaleTimeString()
                        : "—"}
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
