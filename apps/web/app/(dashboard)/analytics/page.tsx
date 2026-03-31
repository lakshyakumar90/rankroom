"use client";

import { useQuery } from "@tanstack/react-query";
import { Role, type ApiResponse } from "@repo/types";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const departmentId = user?.scope.primaryDepartmentId ?? null;
  const sectionId = user?.scope.primarySectionId ?? null;
  const subjectId = user?.teachingAssignments?.[0]?.subjectId ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["analytics-page", role, departmentId, sectionId],
    queryFn: () => {
      if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
        return api.get<ApiResponse<Record<string, unknown>>>("/api/analytics/platform");
      }
      if (role === Role.DEPARTMENT_HEAD && departmentId) {
        return api.get<ApiResponse<Record<string, unknown>>>(`/api/departments/${departmentId}/analytics`);
      }
      if (role === Role.CLASS_COORDINATOR && sectionId) {
        return api.get<ApiResponse<Record<string, unknown>>>(`/api/analytics/section/${sectionId}`);
      }
      if (role === Role.TEACHER && subjectId) {
        return api.get<ApiResponse<Record<string, unknown>>>(`/api/analytics/subject/${subjectId}`);
      }
      return api.get<ApiResponse<Record<string, unknown>>>("/api/analytics/me");
    },
    enabled: !!role,
  });

  const entries = Object.entries(data?.data ?? {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          {role === Role.ADMIN || role === Role.SUPER_ADMIN
            ? "Platform-level activity and oversight metrics."
            : role === Role.DEPARTMENT_HEAD
              ? "Department-level academic and activity insights."
              : role === Role.CLASS_COORDINATOR
                ? "Section-level academic and classroom activity insights."
                : role === Role.TEACHER
                  ? "Subject-level teaching insights for your assigned subject."
                : "Your personal coding and academic analytics."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32" />)
          : entries.map(([key, value]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-sm capitalize">{formatKey(key)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto text-xs text-muted-foreground">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}

function formatKey(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
