"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse } from "@repo/types";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

interface AnalyticsData {
  leaderboard: { totalPoints: number; problemsSolved: number; easySolved: number; mediumSolved: number; hardSolved: number; contestsParticipated: number; rank?: number | null } | null;
  submissionsByStatus: { status: string; _count: number }[];
  heatmap: Record<string, number>;
  contestHistory: { contest: { title: string; startTime: string }; totalScore: number; rank?: number | null }[];
  attendanceBySubject: { status: string; _count: number }[];
}

const DIFF_COLORS = { EASY: "#10b981", MEDIUM: "#f59e0b", HARD: "#ef4444" };
const STATUS_COLORS: Record<string, string> = {
  ACCEPTED: "#10b981",
  WRONG_ANSWER: "#ef4444",
  TIME_LIMIT_EXCEEDED: "#f59e0b",
  COMPILATION_ERROR: "#f97316",
  RUNTIME_ERROR: "#f43f5e",
  PENDING: "#6b7280",
};

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "me"],
    queryFn: () => api.get<ApiResponse<AnalyticsData>>("/api/analytics/me"),
  });

  const analytics = data?.data;

  const difficultyData = analytics ? [
    { name: "Easy", value: analytics.leaderboard?.easySolved ?? 0, color: DIFF_COLORS.EASY },
    { name: "Medium", value: analytics.leaderboard?.mediumSolved ?? 0, color: DIFF_COLORS.MEDIUM },
    { name: "Hard", value: analytics.leaderboard?.hardSolved ?? 0, color: DIFF_COLORS.HARD },
  ] : [];

  const submissionData = (analytics?.submissionsByStatus ?? []).map((s) => ({
    name: s.status.replace(/_/g, " "),
    value: s._count,
    color: STATUS_COLORS[s.status] ?? "#6b7280",
  }));

  const heatmapData = Object.entries(analytics?.heatmap ?? {}).map(([date, count]) => ({
    date: date.slice(5), // MM-DD
    count,
  })).slice(-30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Your performance metrics and trends</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Points", value: analytics?.leaderboard?.totalPoints ?? 0, loading: isLoading },
          { label: "Problems Solved", value: analytics?.leaderboard?.problemsSolved ?? 0, loading: isLoading },
          { label: "Global Rank", value: analytics?.leaderboard?.rank ? `#${analytics.leaderboard.rank}` : "N/A", loading: isLoading },
          { label: "Contests", value: analytics?.leaderboard?.contestsParticipated ?? 0, loading: isLoading },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              {s.loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl font-bold mt-1">{s.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Difficulty breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Problems by Difficulty</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={difficultyData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {difficultyData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Submission status */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Submission Results</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={submissionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {submissionData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Activity heatmap (simplified line chart) */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Daily Submissions (Last 30 Days)</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={heatmapData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
