"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { ApiResponse } from "@repo/types";
import { BarChart3, Building2, Trophy, Users } from "lucide-react";

interface DepartmentAnalyticsData {
  sectionsCount: number;
  studentsCount: number;
  teachersCount: number;
  activeContests: number;
  attendanceSummary: Array<{
    sectionId: string;
    sectionName: string;
    todayAttendancePercentage: number;
  }>;
  topLeaderboard: Array<{
    id: string;
    totalScore: number;
    rank?: number | null;
    student: { id: string; name: string; avatar?: string | null };
  }>;
}

interface DepartmentListItem {
  id: string;
  name: string;
  code: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
}) {
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

export default function DepartmentOverviewPage() {
  const departmentId = useAuthStore((state) => state.user?.scope.primaryDepartmentId);

  const { data: departmentsData } = useQuery({
    queryKey: ["departments", "list"],
    queryFn: () => api.get<ApiResponse<DepartmentListItem[]>>("/api/departments"),
    enabled: !!departmentId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["department", "overview", departmentId],
    queryFn: () =>
      api.get<ApiResponse<DepartmentAnalyticsData>>(
        `/api/departments/${departmentId}/analytics`
      ),
    enabled: !!departmentId,
  });

  const department = useMemo(
    () => departmentsData?.data?.find((item) => item.id === departmentId),
    [departmentId, departmentsData?.data]
  );

  if (!departmentId) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Department Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No department scope is assigned to this account.
          </p>
        </div>
      </div>
    );
  }

  const analytics = data?.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {department?.name ?? "Department"} Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live attendance and leaderboard insight for {department?.code ?? "your department"}.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard label="Total Students" value={analytics?.studentsCount ?? 0} icon={Users} />
            <StatCard label="Total Teachers" value={analytics?.teachersCount ?? 0} icon={Building2} />
            <StatCard label="Sections Count" value={analytics?.sectionsCount ?? 0} icon={BarChart3} />
            <StatCard label="Active Contests" value={analytics?.activeContests ?? 0} icon={Trophy} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Section-wise attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(analytics?.attendanceSummary ?? []).map((section) => (
              <div
                key={section.sectionId}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{section.sectionName}</p>
                  <p className="text-sm text-muted-foreground">Today&apos;s summary</p>
                </div>
                <Badge variant="outline">{section.todayAttendancePercentage}% present</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department leaderboard preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(analytics?.topLeaderboard ?? []).slice(0, 10).map((entry, index) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    #{entry.rank ?? index + 1} {entry.student.name}
                  </p>
                  <p className="text-sm text-muted-foreground">Composite department score</p>
                </div>
                <span className="text-lg font-semibold">{entry.totalScore.toFixed(1)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
