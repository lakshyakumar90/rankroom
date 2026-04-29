"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ApiResponse } from "@repo/types";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type AtRiskStudent = {
  student: { id: string; name: string; email: string; avatar: string | null };
  riskScore: number;
  riskFactors: string[];
  attendancePct: number | null;
  submissionActivity: number;
  acceptanceRate: number;
  missedAssignments: number;
  compositeScore?: number | null;
};

type AtRiskResponse = {
  atRiskStudents: AtRiskStudent[];
  totalStudents: number;
};

export default function DepartmentAtRiskPage() {
  const user = useAuthStore((state) => state.user);
  const sections = user?.scope?.sectionIds ?? [];
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0] ?? "");

  const sectionId = selectedSectionId || sections[0] || "";
  const { data, isLoading } = useQuery({
    queryKey: ["at-risk", sectionId],
    queryFn: () => api.get<ApiResponse<AtRiskResponse>>(`/api/analytics/section/${sectionId}/at-risk`),
    enabled: !!sectionId,
  });

  const students = data?.data?.atRiskStudents ?? [];
  const totalStudents = data?.data?.totalStudents ?? 0;
  const riskRate = useMemo(
    () => (totalStudents > 0 ? Math.round((students.length / totalStudents) * 100) : 0),
    [students.length, totalStudents]
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">At-Risk Students</h1>
        <p className="text-sm text-muted-foreground">
          Flags students using attendance, assignment completion, grades, and coding activity.
        </p>
      </div>

      {sections.length > 1 ? (
        <select
          value={sectionId}
          onChange={(event) => setSelectedSectionId(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {sections.map((id) => (
            <option key={id} value={id}>
              Section {id.slice(0, 8)}
            </option>
          ))}
        </select>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">At-risk students</p>
            <p className="mt-1 text-3xl font-bold">{students.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Section size</p>
            <p className="mt-1 text-3xl font-bold">{totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Risk rate</p>
            <p className="mt-1 text-3xl font-bold">{riskRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flagged Students</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
          ) : students.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No students are currently flagged for this section.
            </p>
          ) : (
            students.map((entry) => (
              <div key={entry.student.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{entry.student.name}</p>
                    <p className="text-sm text-muted-foreground">{entry.student.email}</p>
                  </div>
                  <Badge variant={entry.riskScore >= 60 ? "destructive" : "secondary"}>
                    Risk {entry.riskScore}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Attendance: {entry.attendancePct ?? "N/A"}%</span>
                  <span>Composite: {entry.compositeScore ?? "N/A"}%</span>
                  <span>Missed: {entry.missedAssignments}</span>
                  <span>Submissions: {entry.submissionActivity}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.riskFactors.map((factor) => (
                    <Badge key={factor} variant="outline">
                      {factor}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
