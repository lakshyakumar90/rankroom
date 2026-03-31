"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ApiResponse, type LeaderboardEntry } from "@repo/types";
import { Medal, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { formatPoints } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader, SectionCard } from "@/components/common/page-shell";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"global" | "class" | "dept">("global");

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", tab],
    queryFn: () => api.get<ApiResponse<LeaderboardEntry[]>>("/api/leaderboard/global"),
  });

  const entries = data?.data ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Rankings"
        title="Leaderboard"
        description="The ranking view now uses a consistent tab system, row rhythm, and badge treatment across scopes."
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="gap-4">
        <TabsList className="w-fit rounded-xl">
          <TabsTrigger value="global" className="rounded-lg">Global</TabsTrigger>
          <TabsTrigger value="class" className="rounded-lg">My class</TabsTrigger>
          <TabsTrigger value="dept" className="rounded-lg">Department</TabsTrigger>
        </TabsList>
      </Tabs>

      <SectionCard className="p-0">
        <div className="grid grid-cols-[80px_minmax(0,1fr)_120px_120px] gap-4 border-b border-border/70 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <span>Rank</span>
          <span>Participant</span>
          <span>Points</span>
          <span>Solved</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/70">
            {entries.map((entry, index) => (
              <div
                key={entry.userId}
                className="grid grid-cols-[80px_minmax(0,1fr)_120px_120px] items-center gap-4 px-5 py-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {index < 3 ? (
                    index === 0 ? (
                      <Trophy className="size-4 text-primary" />
                    ) : (
                      <Medal className="size-4 text-muted-foreground" />
                    )
                  ) : null}
                  <span>#{index + 1}</span>
                </div>

                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={entry.user.avatar} name={entry.user.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{entry.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.user.githubUsername ? `github.com/${entry.user.githubUsername}` : "Public profile available"}
                    </p>
                  </div>
                </div>

                <div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {formatPoints(entry.totalPoints)}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground">{entry.problemsSolved}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
