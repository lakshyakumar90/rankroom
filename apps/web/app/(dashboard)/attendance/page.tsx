"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth";
import { Role, type ApiResponse } from "@repo/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";

interface AttendanceSummary {
  records: { attendance: { date: string; subject: { name: string; code: string }; batch: { name: string } }; status: string }[];
  summary: Record<string, { subjectName: string; present: number; absent: number; late: number; total: number }>;
}

export default function AttendancePage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "me"],
    queryFn: () => api.get<ApiResponse<AttendanceSummary>>(`/api/attendance/student/${user!.id}`),
    enabled: !!user && user.role === Role.STUDENT,
  });

  const summary = data?.data?.summary ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Track your attendance across all subjects</p>
        </div>
        {(user?.role === Role.TEACHER || user?.role === Role.ADMIN) && (
          <Link href="/attendance/mark">
            <Button size="sm">Mark Attendance</Button>
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-32 mb-3" />
                <Skeleton className="h-8 w-16 mb-2" />
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          Object.entries(summary).map(([subjectId, stats]) => {
            const percentage = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;
            const isLow = percentage < 75;

            return (
              <Card key={subjectId} className={isLow ? "border-red-500/30" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{stats.subjectName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between mb-3">
                    <div className="text-3xl font-bold">{percentage}%</div>
                    <Badge variant={isLow ? "destructive" : "outline"} className="text-xs">
                      {isLow ? "Low" : "Good"}
                    </Badge>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${isLow ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{stats.present} present</span>
                    <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />{stats.absent} absent</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" />{stats.late} late</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
        {!isLoading && Object.keys(summary).length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No attendance records found</p>
          </div>
        )}
      </div>
    </div>
  );
}
