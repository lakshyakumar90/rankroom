"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth";
import { type ApiResponse, type Grade } from "@repo/types";
import { GraduationCap } from "lucide-react";

export default function GradesPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["grades", "me"],
    queryFn: () => api.get<ApiResponse<(Grade & { subject: { name: string; code: string } })[]>>(`/api/grades/student/${user!.id}`),
    enabled: !!user,
  });

  const grades = data?.data ?? [];

  // Group by subject
  const gradesBySubject = grades.reduce<Record<string, { name: string; code: string; grades: typeof grades }>>((acc, g) => {
    const key = g.subjectId;
    if (!acc[key]) acc[key] = { name: g.subject.name, code: g.subject.code, grades: [] };
    acc[key]!.grades.push(g);
    return acc;
  }, {});

  const getExamBadge = (type: string) => {
    const map: Record<string, string> = { MID: "bg-blue-500/15 text-blue-500", FINAL: "bg-purple-500/15 text-purple-500", INTERNAL: "bg-amber-500/15 text-amber-500", ASSIGNMENT: "bg-emerald-500/15 text-emerald-500" };
    return map[type] ?? "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grades</h1>
        <p className="text-muted-foreground">Your academic performance across all subjects</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))
        ) : Object.keys(gradesBySubject).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No grades available yet</p>
          </div>
        ) : (
          Object.entries(gradesBySubject).map(([subjectId, { name, code, grades: subGrades }]) => {
            const avg = subGrades.reduce((sum, g) => sum + (g.marks / g.maxMarks) * 100, 0) / subGrades.length;
            return (
              <Card key={subjectId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{code}</span>
                      <Badge variant="outline">{avg.toFixed(1)}% avg</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {subGrades.map((g) => (
                      <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${getExamBadge(g.examType)}`}>{g.examType}</span>
                          <span className="text-sm text-muted-foreground">Semester {g.semester}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{g.marks} / {g.maxMarks}</p>
                          <p className="text-xs text-muted-foreground">{((g.marks / g.maxMarks) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
