"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Building2, Trophy, Users } from "lucide-react";
import type { ApiResponse } from "@repo/types";

interface DepartmentAnalytics {
  sectionsCount: number;
  studentsCount: number;
  teachersCount: number;
  activeContests: number;
  attendanceSummary: Array<{ sectionId: string; sectionName: string; todayAttendancePercentage: number }>;
  topLeaderboard: Array<{
    id: string;
    totalScore: number;
    rank?: number | null;
    student: { id: string; name: string; avatar?: string | null };
  }>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Users }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DepartmentOverviewTab({ departmentId }: { departmentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["department", "analytics", departmentId],
    queryFn: () => api.get<ApiResponse<DepartmentAnalytics>>(`/api/departments/${departmentId}/analytics`),
    enabled: !!departmentId,
  });

  const analytics = data?.data;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Students" value={analytics?.studentsCount ?? 0} icon={Users} />
            <StatCard label="Teachers" value={analytics?.teachersCount ?? 0} icon={Building2} />
            <StatCard label="Sections" value={analytics?.sectionsCount ?? 0} icon={BarChart3} />
            <StatCard label="Active Contests" value={analytics?.activeContests ?? 0} icon={Trophy} />
          </>
        )}
      </div>

      {/* Attendance + leaderboard */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s attendance by section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              : (analytics?.attendanceSummary ?? []).map((section) => (
                  <div
                    key={section.sectionId}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <p className="text-sm font-medium">{section.sectionName}</p>
                    <Badge
                      variant={section.todayAttendancePercentage >= 75 ? "default" : "destructive"}
                    >
                      {section.todayAttendancePercentage}%
                    </Badge>
                  </div>
                ))}
            {!isLoading && (analytics?.attendanceSummary ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No attendance data for today.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              : (analytics?.topLeaderboard ?? []).slice(0, 8).map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-xs font-mono text-muted-foreground">
                        #{entry.rank ?? idx + 1}
                      </span>
                      <p className="text-sm font-medium">{entry.student.name}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{entry.totalScore.toFixed(1)}</span>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
