"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiResponse } from "@repo/types";

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
    student: {
      id: string;
      name: string;
      studentProfile?: { cgpa?: number | null; leetcodeSolved?: number | null } | null;
    };
  }>;
}

export default function DepartmentAnalyticsPage() {
  const departmentId = useAuthStore((state) => state.user?.scope.primaryDepartmentId);

  const { data, isLoading } = useQuery({
    queryKey: ["department", "analytics", departmentId],
    queryFn: () =>
      api.get<ApiResponse<DepartmentAnalyticsData>>(
        `/api/departments/${departmentId}/analytics`
      ),
    enabled: !!departmentId,
  });

  const analytics = data?.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Department Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attendance, academic, and coding signals across your department.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-xl" />
                ))
              : (analytics?.attendanceSummary ?? []).map((section) => (
                  <div
                    key={section.sectionId}
                    className="rounded-xl border border-border px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{section.sectionName}</p>
                      <span className="text-sm font-semibold">
                        {section.todayAttendancePercentage}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${section.todayAttendancePercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Academic + Coding Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-xl" />
                ))
              : (analytics?.topLeaderboard ?? []).map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        #{entry.rank ?? index + 1} {entry.student.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        CGPA {entry.student.studentProfile?.cgpa ?? "N/A"} • LC{" "}
                        {entry.student.studentProfile?.leetcodeSolved ?? 0}
                      </p>
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
