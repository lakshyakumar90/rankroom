"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Role, type ApiResponse } from "@repo/types";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Users,
  XCircle,
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

interface AttendanceOverview {
  role: Role;
  totals: {
    present: number;
    absent: number;
    late: number;
    total: number;
    sessions: number;
    percentage: number;
  };
  subjects: AttendanceSubjectOverview[];
}

interface AttendanceSubjectOverview {
  subject: {
    id: string;
    name: string;
    code: string;
    minimumAttendancePct: number;
  };
  section: {
    id: string;
    name: string;
    code: string;
    department: { id: string; name: string; code: string };
    _count: { enrollments: number };
  };
  totals: {
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
    sessions: number;
    enrolledStudents: number;
  };
  recentSessions: Array<{
    id: string;
    date: string;
    topic?: string | null;
    present: number;
    absent: number;
    late: number;
    total: number;
    takenBy: { id: string; name: string };
  }>;
}

function canMarkAttendance(role: Role | null | undefined) {
  return (
    role === Role.ADMIN ||
    role === Role.SUPER_ADMIN ||
    role === Role.DEPARTMENT_HEAD ||
    role === Role.CLASS_COORDINATOR ||
    role === Role.TEACHER
  );
}

function attendanceTone(percentage: number, threshold = 75) {
  if (percentage >= threshold) return "text-emerald-600 dark:text-emerald-400";
  if (percentage >= Math.max(50, threshold - 15)) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function AttendanceStatusBadge({ percentage, threshold }: { percentage: number; threshold: number }) {
  const healthy = percentage >= threshold;
  return (
    <Badge variant="outline" className={healthy ? "border-emerald-500/30 text-emerald-600" : "border-red-500/30 text-red-600"}>
      {healthy ? "Healthy" : "Below threshold"}
    </Badge>
  );
}

function SubjectSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-18 rounded-xl" />
      ))}
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const isStudent = role === Role.STUDENT;

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", "overview"],
    queryFn: () => api.get<ApiResponse<AttendanceOverview>>("/api/attendance/overview"),
    enabled: !!user,
  });

  const overview = data?.data;
  const subjects = overview?.subjects ?? [];
  const totals = overview?.totals ?? { present: 0, absent: 0, late: 0, total: 0, sessions: 0, percentage: 0 };
  const recentSessions = subjects.flatMap((subject) =>
    subject.recentSessions.map((session) => ({ ...session, subject, section: subject.section }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={isStudent ? "My attendance" : "Attendance overview"}
        title="Attendance"
        description={
          isStudent
            ? "See your attendance across every subject in your assigned section."
            : "Review attendance by subject across the classes and departments available in your scope."
        }
        actions={
          canMarkAttendance(role) ? (
            <Button asChild className="rounded-xl">
              <Link href="/attendance/mark">
                <Plus className="mr-2 size-4" />
                Take Attendance
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Attendance rate" value={`${totals.percentage}%`} description="Weighted by late policy" icon={CheckCircle2} loading={isLoading} tone="success" />
        <MetricCard title="Present" value={totals.present} description={isStudent ? "Classes attended" : "Present records"} icon={CheckCircle2} loading={isLoading} />
        <MetricCard title="Absent" value={totals.absent} description={isStudent ? "Missed classes" : "Absent records"} icon={XCircle} loading={isLoading} tone="warning" />
        <MetricCard title={isStudent ? "Subjects" : "Sessions"} value={isStudent ? subjects.length : totals.sessions} description={isStudent ? "Subjects tracked" : "Attendance sessions"} icon={isStudent ? BookOpen : Calendar} loading={isLoading} />
      </div>

      <section className="page-section">
        <SectionHeading
          title={isStudent ? "Subject-wise attendance" : "Subject attendance by scope"}
          description={
            isStudent
              ? "Every subject in your assigned section appears here, including subjects with no attendance marked yet."
              : "Admins see all subjects, department heads see their department, class coordinators see their sections, and teachers see subjects they teach."
          }
        />
        <SectionCard className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-5 w-44" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="mx-auto h-5 w-10" /></TableCell>
                      <TableCell><Skeleton className="mx-auto h-5 w-10" /></TableCell>
                      <TableCell><Skeleton className="mx-auto h-5 w-10" /></TableCell>
                      <TableCell><Skeleton className="mx-auto h-5 w-10" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-5 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : subjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40">
                      <EmptyState
                        title={isStudent ? "No subjects assigned yet" : "No attendance subjects found"}
                        description={
                          isStudent
                            ? "Once an admin assigns you to a section with subjects, your attendance will appear here."
                            : "No subjects are available in your current attendance scope."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  subjects.map((entry) => (
                    <TableRow key={entry.subject.id}>
                      <TableCell>
                        <p className="font-medium">{entry.subject.name}</p>
                        <p className="text-xs text-muted-foreground">{entry.subject.code}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{entry.section.name}</p>
                        <p className="text-xs text-muted-foreground">{entry.section.department.code}</p>
                      </TableCell>
                      <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">{entry.totals.present}</TableCell>
                      <TableCell className="text-center font-medium text-red-600 dark:text-red-400">{entry.totals.absent}</TableCell>
                      <TableCell className="text-center font-medium text-amber-600 dark:text-amber-400">{entry.totals.late}</TableCell>
                      <TableCell className="text-center">{entry.totals.sessions}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <AttendanceStatusBadge percentage={entry.totals.percentage} threshold={entry.subject.minimumAttendancePct} />
                          <span className={`font-semibold ${attendanceTone(entry.totals.percentage, entry.subject.minimumAttendancePct)}`}>
                            {entry.totals.percentage}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </section>

      {!isStudent ? (
        <section className="page-section">
          <SectionHeading
            title="Scoped class cards"
            description="Quick scan of every subject you can monitor."
          />
          {isLoading ? (
            <SubjectSkeleton />
          ) : subjects.length === 0 ? null : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {subjects.map((entry) => (
                <Card key={entry.subject.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-start justify-between gap-3 text-base">
                      <span>{entry.subject.name}</span>
                      <AttendanceStatusBadge percentage={entry.totals.percentage} threshold={entry.subject.minimumAttendancePct} />
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {entry.section.name} · {entry.section.department.name}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Attendance</span>
                        <span className={`font-semibold ${attendanceTone(entry.totals.percentage, entry.subject.minimumAttendancePct)}`}>
                          {entry.totals.percentage}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={entry.totals.percentage >= entry.subject.minimumAttendancePct ? "h-2 rounded-full bg-emerald-500" : "h-2 rounded-full bg-red-500"}
                          style={{ width: `${Math.min(entry.totals.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-xl bg-muted/40 p-3">
                        <p className="font-semibold">{entry.totals.present}</p>
                        <p className="text-xs text-muted-foreground">Present</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3">
                        <p className="font-semibold">{entry.totals.absent}</p>
                        <p className="text-xs text-muted-foreground">Absent</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3">
                        <p className="font-semibold">{entry.totals.enrolledStudents}</p>
                        <p className="text-xs text-muted-foreground">Students</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="page-section">
        <SectionHeading
          title={isStudent ? "Recent attendance" : "Recent sessions"}
          description={isStudent ? "Latest marked attendance records." : "Latest sessions across your attendance scope."}
        />
        <SectionCard className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : recentSessions.length ? (
            <div className="flex flex-col divide-y divide-border/70">
              {recentSessions.slice(0, 12).map((session) => (
                <div key={`${session.subject.subject.id}-${session.id}`} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                      {isStudent ? <Clock className="size-4" /> : <Calendar className="size-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{session.subject.subject.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.subject.subject.code} · {session.section.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-muted-foreground">{new Date(session.date).toLocaleDateString()}</p>
                    <Badge variant="outline">
                      {isStudent ? `${session.present ? "Present" : session.late ? "Late" : "Absent"}` : `${session.present}/${session.total} present`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No attendance records yet"
              description={isStudent ? "Once attendance is marked for your classes, records will appear here." : "Attendance sessions will appear here once they are taken."}
            />
          )}
        </SectionCard>
      </section>
    </PageContainer>
  );
}
