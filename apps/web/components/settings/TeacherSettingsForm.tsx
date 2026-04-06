"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiResponse } from "@repo/types";

interface TeachingAssignment {
  id: string;
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; code: string; academicYear: string };
}

export function TeacherSettingsForm() {
  const { data, isLoading } = useQuery({
    queryKey: ["teacher-assignments"],
    queryFn: () => api.get<ApiResponse<TeachingAssignment[]>>("/api/profile/teaching-assignments"),
  });

  const assignments = data?.data ?? [];

  return (
    <div className="grid w-full max-w-3xl gap-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Assigned subjects</CardTitle>
          <CardDescription>Subjects and sections you are currently assigned to.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teaching assignments found.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{a.subject.name}</p>
                    <p className="text-xs text-muted-foreground">{a.section.name} · {a.section.academicYear}</p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">{a.subject.code}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
