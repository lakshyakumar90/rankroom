"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Role, type ApiResponse } from "@repo/types";
import {
  Calendar, CheckCircle2, Clock, XCircle, Plus,
  BarChart3, BookOpen, Users, ChevronRight
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { MetricCard } from "@/components/common/metric-card";
import { EmptyState, PageContainer, PageHeader, SectionCard, SectionHeading } from "@/components/common/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

interface TeacherSession {
  id: string;
  date: string;
  topic?: string | null;
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; code: string };
  _count: { records: number };
  presentCount?: number;
  absentCount?: number;
}

interface TeacherAttendanceData {
  sessions: TeacherSession[];
  summary: {
    totalSessions: number;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    sectionSummary: Array<{
      sectionId: string;
      sectionName: string;
      sessionCount: number;
      avgAttendance: number;
    }>;
  };
}

function teacherRoles(role: Role) {
  return [Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN, Role.CLASS_COORDINATOR, Role.DEPARTMENT_HEAD].includes(role);
}

function AttendanceBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    PRESENT: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    ABSENT: "bg-red-500/10 text-red-600 border-red-200",
    LATE: "bg-amber-500/10 text-amber-600 border-amber-200",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${variants[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

// ─── Teacher View ─────────────────────────────────────────────────────────────
function TeacherAttendanceView() {
  const { user } = useAuthStore();
  const sectionIds = user?.scope?.sectionIds ?? [];
  const [selectedSection, setSelectedSection] = useState(sectionIds[0] ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-attendance", selectedSection],
    queryFn: async () => {
      // Fetch recent attendance sessions for this teacher's sections
      const sid = selectedSection || sectionIds[0];
      if (!sid) return null;
      const res = await api.get<ApiResponse<{
        sessions: TeacherSession[];
        summary: TeacherAttendanceData["summary"];
      }>>(`/api/attendance/section/${sid}/subject/${user?.teachingAssignments?.[0]?.subjectId ?? ""}/summary`).catch(() => null);
      return res;
    },
    enabled: !!user && sectionIds.length > 0,
  });

  // Separate query for section-level sessions
  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ["teacher-sections-attendance-overview", sectionIds],
    queryFn: async () => {
      const results = await Promise.allSettled(
        sectionIds.map((sid) =>
          api.get<ApiResponse<{
            summary: Array<{ subjectName: string; present: number; absent: number; late: number; total: number }>;
            recentSessions: TeacherSession[];
          }>>(`/api/attendance/section/${sid}/subject/${user?.teachingAssignments?.find((a) => a.sectionId === sid)?.subjectId ?? ""}/summary`)
        )
      );
      return results;
    },
    enabled: !!user && teacherRoles(user.role) && sectionIds.length > 0,
  });

  // Fallback: get any recent sessions directly  
  const { data: mySessionsData, isLoading: mySessionsLoading } = useQuery({
    queryKey: ["my-attendance-sessions", user?.id],
    queryFn: () =>
      api.get<ApiResponse<TeacherSession[]>>(`/api/attendance/section/${sectionIds[0]}/low-attendance`).catch(() =>
        ({ data: [] as TeacherSession[], success: true })
      ),
    enabled: !!user && teacherRoles(user.role) && sectionIds.length > 0,
  });

  const assignments = user?.teachingAssignments ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Teacher view"
        title="Attendance"
        description="Review attendance for your classes, take new sessions, and monitor low-attendance students."
        actions={
          <Button asChild className="rounded-xl">
            <Link href="/attendance/mark">
              <Plus className="mr-2 size-4" />
              Take Attendance
            </Link>
          </Button>
        }
      />

      {/* Stats overview */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Assigned Subjects"
          value={assignments.length}
          description="Subjects you teach"
          icon={BookOpen}
          loading={false}
        />
        <MetricCard
          title="Sections"
          value={sectionIds.length}
          description="Classes you cover"
          icon={Users}
          loading={false}
        />
        <MetricCard
          title="Quick Action"
          value="Mark"
          description="Start a new attendance session"
          icon={CheckCircle2}
          loading={false}
          tone="success"
        />
        <MetricCard
          title="Reports"
          value="View"
          description="Section-level attendance data"
          icon={BarChart3}
          loading={false}
        />
      </div>

      {/* Teaching assignments */}
      {assignments.length > 0 && (
        <section className="page-section">
          <SectionHeading
            title="Your classes"
            description="Click on a class to view attendance details or mark new attendance."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {assignments.map((assignment) => (
              <Card key={assignment.subjectId} className="group cursor-pointer hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{assignment.subject?.name ?? assignment.subjectId}</p>
                    <p className="text-sm text-muted-foreground">{assignment.section?.name ?? assignment.sectionId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/attendance/mark">
                        <Plus className="mr-1 size-3" />
                        Mark
                      </Link>
                    </Button>
                    <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Empty state when no assignments */}
      {!sectionsLoading && assignments.length === 0 && (
        <SectionCard>
          <EmptyState
            title="No teaching assignments yet"
            description="Once you're assigned to subjects, your attendance data will appear here."
            action={
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/attendance/mark">Open attendance marking</Link>
              </Button>
            }
          />
        </SectionCard>
      )}

      {/* Low attendance alert */}
      {sectionIds.length > 0 && (
        <section className="page-section">
          <SectionHeading
            title="Manage attendance"
            description="Access your recent sessions or check low-attendance reports."
          />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/attendance/mark">
                <Plus className="mr-2 size-4" />
                New attendance session
              </Link>
            </Button>
            {sectionIds[0] && (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/attendance/mark?sectionId=${sectionIds[0]}`}>
                  <BarChart3 className="mr-2 size-4" />
                  View section report
                </Link>
              </Button>
            )}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

// ─── Student View ──────────────────────────────────────────────────────────────
function StudentAttendanceView() {
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
      />

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
        <SectionCard className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-right">Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : summaryEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No attendance data available yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  summaryEntries.map((subject) => {
                    const percentage = subject.total ? Math.round((subject.present / subject.total) * 100) : 0;
                    return (
                      <TableRow key={subject.subjectName}>
                        <TableCell className="font-medium">{subject.subjectName}</TableCell>
                        <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">{subject.present}</TableCell>
                        <TableCell className="text-center font-medium text-red-600 dark:text-red-400">{subject.absent}</TableCell>
                        <TableCell className="text-center font-medium text-amber-600 dark:text-amber-400">{subject.late}</TableCell>
                        <TableCell className="text-center font-semibold">{subject.total}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="h-2 w-16 rounded-full bg-muted hidden sm:block">
                              <div
                                className={`h-2 rounded-full ${percentage >= 75 ? "bg-emerald-500" : percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className={`font-semibold ${percentage >= 75 ? "text-emerald-600 dark:text-emerald-400" : percentage >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                              {percentage}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </section>

      <section className="page-section">
        <SectionHeading
          title="Recent activity"
          description="Latest attendance records."
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
                    <AttendanceBadge status={record.status} />
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
    </PageContainer>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { user } = useAuthStore();

  if (!user) return null;

  if (teacherRoles(user.role)) {
    return <TeacherAttendanceView />;
  }

  return <StudentAttendanceView />;
}
