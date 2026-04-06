"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ApiResponse, type LeaderboardScopedResponse } from "@repo/types";
import { AlertTriangle, Award, Lightbulb, Medal, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader, SectionCard } from "@/components/common/page-shell";

type LeaderboardTab = "global" | "class" | "dept" | "insights";

type LeaderboardInsights = {
  summary: string;
  topPerformers: string;
  risingStars: string;
  areasOfConcern: string;
  actionableAdvice?: string[];
};

type LeaderboardInsightsResponse = ApiResponse<LeaderboardInsights> & {
  insights?: string;
};

export default function LeaderboardPage() {
  const [tab, setTab] = useState<LeaderboardTab>("global");
  const { user } = useAuthStore();

  const sectionId = user?.enrollments?.[0]?.sectionId ?? null;
  const departmentId = user?.enrollments?.[0]?.section.department.id ?? null;

  const endpoint = useMemo(() => {
    if (tab === "class" && sectionId) return `/api/leaderboard/class/${sectionId}`;
    if (tab === "dept" && departmentId) return `/api/leaderboard/department/${departmentId}`;
    return "/api/leaderboard/global";
  }, [departmentId, sectionId, tab]);

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", tab, sectionId, departmentId],
    queryFn: () => api.get<ApiResponse<LeaderboardScopedResponse>>(endpoint),
    enabled: tab !== "insights",
  });

  const { data: insightsData, isLoading: isLoadingInsights } = useQuery({
    queryKey: ["leaderboard-insights", sectionId],
    queryFn: () =>
      api.get<LeaderboardInsightsResponse>(`/api/leaderboard/section/${sectionId}/insights`),
    enabled: tab === "insights" && !!sectionId,
  });

  const leaderboard = data?.data;
  const entries = leaderboard?.items ?? [];
  const selfEntry = leaderboard?.self ?? null;
  const insights = insightsData?.data;
  const insightsFallbackMessage = insightsData?.insights ?? "Could not load AI insights at this time.";
  const hasInsights = Boolean(
    insights?.summary ||
    insights?.topPerformers ||
    insights?.risingStars ||
    insights?.areasOfConcern ||
    insights?.actionableAdvice?.length
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Rankings"
        title="Leaderboard"
        description="Students see the top 10 plus their own exact rank. Staff can browse the full weighted leaderboard by scope."
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as LeaderboardTab)} className="gap-4">
        <TabsList className="w-fit rounded-xl">
          <TabsTrigger value="global" className="rounded-lg">Global</TabsTrigger>
          {sectionId ? <TabsTrigger value="class" className="rounded-lg">My class</TabsTrigger> : null}
          {departmentId ? <TabsTrigger value="dept" className="rounded-lg">Department</TabsTrigger> : null}
          {sectionId ? (
            <TabsTrigger value="insights" className="rounded-lg gap-2 text-primary data-[state=active]:bg-primary/10">
              <Sparkles className="size-3.5 fill-primary/20" /> AI Insights
            </TabsTrigger>
          ) : null}
        </TabsList>
      </Tabs>

      {tab === "insights" ? (
        <SectionCard className="overflow-hidden p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5 fill-primary/20" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Predictive Analytics</h3>
              <p className="text-sm text-muted-foreground">AI-driven insights for your academic section</p>
            </div>
          </div>

          {isLoadingInsights ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-28 w-full rounded-xl" />
              <div className="grid gap-4 lg:grid-cols-3">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : hasInsights && insights ? (
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-primary/20 bg-linear-to-br from-primary/15 via-primary/5 to-background p-5">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Sparkles className="size-4 fill-primary/20" />
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em]">Section Summary</h4>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{insights.summary}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-5">
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <Award className="size-4" />
                    <h4 className="text-sm font-semibold uppercase tracking-[0.12em]">Top Performers</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{insights.topPerformers}</p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 p-5">
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <TrendingUp className="size-4" />
                    <h4 className="text-sm font-semibold uppercase tracking-[0.12em]">Rising Stars</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{insights.risingStars}</p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 p-5">
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <AlertTriangle className="size-4" />
                    <h4 className="text-sm font-semibold uppercase tracking-[0.12em]">Areas of Concern</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{insights.areasOfConcern}</p>
                </div>
              </div>

              {insights.actionableAdvice?.length ? (
                <div className="rounded-2xl border border-border/70 bg-secondary/20 p-5">
                  <div className="mb-4 flex items-center gap-2 text-primary">
                    <Lightbulb className="size-4" />
                    <h4 className="text-sm font-semibold uppercase tracking-[0.12em]">Action Plan</h4>
                  </div>

                  <div className="flex flex-col gap-3">
                    {insights.actionableAdvice.map((advice, index) => (
                      <div key={advice} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-3">
                        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">{advice}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
              {insightsFallbackMessage}
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard className="p-0">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {leaderboard?.viewerMode === "restricted" ? "Top 10 + your rank" : "Full leaderboard"}
            </div>
            {leaderboard ? (
              <Badge variant="outline" className="rounded-full">
                {leaderboard.pagination.total} ranked
              </Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-[80px_minmax(0,1fr)_120px_100px_100px] gap-4 border-b border-border/70 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span>Rank</span>
            <span>Participant</span>
            <span>Score</span>
            <span>Streak</span>
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
                  className="grid grid-cols-[80px_minmax(0,1fr)_120px_100px_100px] items-center gap-4 px-5 py-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {index < 3 ? index === 0 ? <Trophy className="size-4 text-primary" /> : <Medal className="size-4 text-muted-foreground" /> : null}
                    <span>#{entry.rank}</span>
                  </div>

                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={entry.student.avatar} name={entry.student.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{entry.student.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.student.githubUsername ? `github.com/${entry.student.githubUsername}` : "Weighted leaderboard score"}
                      </p>
                    </div>
                  </div>

                  <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                    {entry.totalScore.toFixed(2)}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{entry.currentStreak}</p>
                  <p className="text-sm text-muted-foreground">{"problemsSolved" in entry ? Number(entry.problemsSolved ?? 0) : 0}</p>
                </div>
              ))}

              {selfEntry ? (
                <div className="grid grid-cols-[80px_minmax(0,1fr)_120px_100px_100px] items-center gap-4 bg-primary/5 px-5 py-4">
                  <div className="text-sm font-semibold">#{selfEntry.rank}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selfEntry.student.name}</p>
                    <p className="text-xs text-muted-foreground">Your position outside the top 10</p>
                  </div>
                  <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                    {selfEntry.totalScore.toFixed(2)}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{selfEntry.currentStreak}</p>
                  <p className="text-sm text-muted-foreground">{"problemsSolved" in selfEntry ? Number(selfEntry.problemsSolved ?? 0) : 0}</p>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>
      )}
    </PageContainer>
  );
}
