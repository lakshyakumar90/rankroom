"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Role, type ApiResponse } from "@repo/types";
import { Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { MetricCard } from "@/components/common/metric-card";
import { EmptyState, PageContainer, PageHeader, SectionCard, SectionHeading } from "@/components/common/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AttendanceSummary {
  records: {
    attendance: { date: string; subject: { name: string; code: string }; batch: { name: string } };
    status: string;
  }[];
  summary: Record<
    string,
    { subjectName: string; present: number; absent: number; late: number; total: number }
  >;
}

export default function AttendancePage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "me"],
    queryFn: () => api.get<ApiResponse<AttendanceSummary>>(`/api/attendance/student/${user!.id}`),
    enabled: !!user && user.role === Role.STUDENT,
  });

  const summaryEntries = Object.values(data?.data?.summary ?? {});
  const recentRecords = data?.data?.records ?? [];
  const totals = summaryEntries.reduce(
    (acc, subject) => {
      acc.present += subject.present;
      acc.absent += subject.absent;
      acc.late += subject.late;
      acc.total += subject.total;
      return acc;
    },
    { present: 0, absent: 0, late: 0, total: 0 }
  );

  const attendanceRate = totals.total ? `${Math.round((totals.present / totals.total) * 100)}%` : "0%";

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Academic overview"
        title="Attendance"
        description="A cleaner view of subject-level health, recent records, and any action you need to take."
        actions={
          user && [Role.TEACHER, Role.ADMIN, Role.CLASS_COORDINATOR].includes(user.role) ? (
            <Button asChild className="rounded-xl">
              <Link href="/attendance/mark">Mark attendance</Link>
            </Button>
          ) : null
        }
      />

      {user?.role !== Role.STUDENT ? (
        <SectionCard>
          <EmptyState
            title="Attendance details are student-facing here"
            description="Use the attendance marking flow to take attendance for your assigned classes, or switch into a student account to review personal records."
            action={
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/attendance/mark">Open attendance marking</Link>
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Attendance rate" value={attendanceRate} description="Present sessions" icon={CheckCircle2} loading={isLoading} tone="success" />
            <MetricCard title="Present" value={totals.present} description="Classes attended" icon={CheckCircle2} loading={isLoading} />
            <MetricCard title="Absent" value={totals.absent} description="Missed sessions" icon={XCircle} loading={isLoading} tone="warning" />
            <MetricCard title="Late" value={totals.late} description="Late check-ins" icon={Clock} loading={isLoading} tone="accent" />
          </div>

          <section className="page-section">
            <SectionHeading
              title="Subject summary"
              description="Each course uses the same card structure and spacing so percentage comparisons are easier to scan."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="rounded-xl border-border/70 bg-card/88 shadow-sm">
                      <CardContent className="p-5">
                        <Skeleton className="mb-4 h-5 w-40 rounded-lg" />
                        <Skeleton className="h-4 w-24 rounded-lg" />
                      </CardContent>
                    </Card>
                  ))
                : summaryEntries.map((subject) => {
                    const percentage = subject.total ? Math.round((subject.present / subject.total) * 100) : 0;

                    return (
                      <Card key={subject.subjectName} className="rounded-xl border-border/70 bg-card/88 shadow-sm">
                        <CardContent className="flex flex-col gap-4 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col gap-1">
                              <h3 className="text-base font-semibold">{subject.subjectName}</h3>
                              <p className="text-sm text-muted-foreground">
                                {subject.present} present • {subject.absent} absent • {subject.late} late
                              </p>
                            </div>
                            <Badge variant={percentage >= 75 ? "secondary" : "outline"} className="rounded-full px-3 py-1">
                              {percentage}%
                            </Badge>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
            </div>
          </section>

          <section className="page-section">
            <SectionHeading
              title="Recent activity"
              description="Latest attendance records use one repeatable timeline treatment instead of ad hoc lists."
            />
            <SectionCard className="p-0">
              {isLoading ? (
                <div className="flex flex-col gap-3 p-5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 rounded-xl" />
                  ))}
                </div>
              ) : recentRecords.length ? (
                <div className="flex flex-col divide-y divide-border/70">
                  {recentRecords.slice(0, 8).map((record, index) => (
                    <div key={`${record.attendance.date}-${index}`} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                          <Calendar className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{record.attendance.subject.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.attendance.subject.code} • {record.attendance.batch.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-muted-foreground">
                          {new Date(record.attendance.date).toLocaleDateString()}
                        </p>
                        <Badge variant={record.status === "PRESENT" ? "secondary" : "outline"} className="rounded-full px-3 py-1">
                          {record.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No attendance records yet"
                  description="Once attendance is marked for your classes, the most recent entries will appear here."
                />
              )}
            </SectionCard>
          </section>
        </>
      )}
    </PageContainer>
  );
}
