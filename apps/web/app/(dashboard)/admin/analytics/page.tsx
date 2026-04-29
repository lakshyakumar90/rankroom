"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Activity, BarChart3, Trophy, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiResponse } from "@repo/types";

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "analytics", "platform"],
    queryFn: () => api.get<ApiResponse<Record<string, unknown>>>("/api/analytics/platform"),
  });

  const analytics = data?.data ?? {};
  const metrics = [
    ["Users", analytics.totalUsers ?? analytics.users ?? "—", Users],
    ["Submissions", analytics.totalSubmissions ?? analytics.submissions ?? "—", Activity],
    ["Contests", analytics.totalContests ?? analytics.contests ?? "—", Trophy],
    ["Active Today", analytics.activeToday ?? analytics.todayActiveUsers ?? "—", BarChart3],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Analytics</h1>
          <p className="text-sm text-muted-foreground">Platform-wide usage, participation, and performance signals.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/analytics">Open full analytics</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-semibold">{String(value)}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-2xl bg-muted p-4 text-xs text-muted-foreground">
              {JSON.stringify(analytics, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
