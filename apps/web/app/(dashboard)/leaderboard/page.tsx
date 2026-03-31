"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ApiResponse, type LeaderboardEntry } from "@repo/types";
import { Medal, Trophy, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { formatPoints } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader, SectionCard } from "@/components/common/page-shell";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"global" | "class" | "dept" | "insights">("global");
  const { user } = useAuthStore();
  
  const sectionId = user?.enrollments?.[0]?.sectionId;

  const endpoint = (() => {
    if (tab === "global") return "/api/leaderboard/global";
    if (tab === "class" && sectionId) return `/api/leaderboard/class/${sectionId}`;
    if (tab === "dept" && user?.profile?.department) return `/api/leaderboard/department/${user.profile.department}`;
    return "/api/leaderboard/global"; // Fallback
  })();

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", tab, sectionId],
    queryFn: () => api.get<ApiResponse<LeaderboardEntry[]>>(endpoint),
  });

  const { data: insightsData, isLoading: isLoadingInsights } = useQuery({
    queryKey: ["leaderboard-insights", sectionId],
    queryFn: () => api.get<ApiResponse<{ success: boolean; data?: any; insights?: string }>>(`/api/leaderboard/section/${sectionId}/insights`),
    enabled: tab === "insights" && !!sectionId,
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
          {sectionId && <TabsTrigger value="class" className="rounded-lg">My class</TabsTrigger>}
          <TabsTrigger value="dept" className="rounded-lg">Department</TabsTrigger>
          {sectionId && (
            <TabsTrigger value="insights" className="rounded-lg gap-2 text-primary data-[state=active]:bg-primary/10">
              <Sparkles className="size-3.5 fill-primary/20" /> AI Insights
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {tab === "insights" ? (
        <SectionCard className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5 fill-primary/20" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Predictive Analytics</h3>
              <p className="text-sm text-muted-foreground">AI-driven insights for your academic section</p>
            </div>
          </div>
          
          {isLoadingInsights ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-xl" />
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            </div>
          ) : insightsData?.data?.data ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm leading-relaxed text-foreground/90">
                {insightsData.data.data.summary}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-border p-5">
                  <h4 className="mb-3 font-semibold text-emerald-600 dark:text-emerald-400">Rising Stars & Trend</h4>
                  <p className="text-sm text-muted-foreground">{insightsData.data.data.risingStars}</p>
                </div>
                <div className="rounded-xl border border-border p-5">
                  <h4 className="mb-3 font-semibold text-amber-600 dark:text-amber-400">Areas of Concern</h4>
                  <p className="text-sm text-muted-foreground">{insightsData.data.data.areasOfConcern}</p>
                </div>
              </div>
              <div className="rounded-xl border border-border p-5">
                <h4 className="mb-3 font-semibold">Top Performers Breakdown</h4>
                <p className="text-sm text-muted-foreground">{insightsData.data.data.topPerformers}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-5">
                <h4 className="mb-3 font-semibold">Actionable Advice</h4>
                <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                  {insightsData.data.data.actionableAdvice?.map((advice: string, index: number) => (
                    <li key={index}>{advice}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
             <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
               {insightsData?.data?.insights || "Could not load AI insights at this time."}
             </div>
          )}
        </SectionCard>
      ) : (
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
      )}
    </PageContainer>
  );
}
