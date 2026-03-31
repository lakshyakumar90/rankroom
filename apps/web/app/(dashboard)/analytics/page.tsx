"use client";

import { useQuery } from "@tanstack/react-query";
import { Role, type ApiResponse } from "@repo/types";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Building2, BookOpen, Trophy, Activity, TrendingUp,
  CheckCircle2, XCircle, Clock, BarChart3, GraduationCap,
  Layers, Star, Code2, Target, Award
} from "lucide-react";

// ─── Metric Card ────────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, color = "primary",
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: "primary" | "success" | "warn" | "info" | "purple";
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-500",
    warn: "bg-amber-500/10 text-amber-500",
    info: "bg-sky-500/10 text-sky-500",
    purple: "bg-purple-500/10 text-purple-500",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────
function ProgressBar({ label, value, total, color = "bg-primary" }: {
  label: string; value: number; total: number; color?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────────
function SH({ title }: { title: string }) {
  return <h2 className="text-base font-semibold tracking-tight">{title}</h2>;
}

// ─── Attendance donut info ────────────────────────────────────────────────────
function AttendanceSummary({ data }: { data: { status: string; _count: number }[] }) {
  const present = data.find((d) => d.status === "PRESENT")?._count ?? 0;
  const absent = data.find((d) => d.status === "ABSENT")?._count ?? 0;
  const late = data.find((d) => d.status === "LATE")?._count ?? 0;
  const total = present + absent + late;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">{rate}%</div>
        <div className="space-y-1 flex-1">
          <ProgressBar label="Present" value={present} total={total} color="bg-emerald-500" />
          <ProgressBar label="Absent" value={absent} total={total} color="bg-red-500" />
          <ProgressBar label="Late" value={late} total={total} color="bg-amber-500" />
        </div>
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="size-3 text-emerald-500" />{present} present</span>
        <span className="flex items-center gap-1"><XCircle className="size-3 text-red-500" />{absent} absent</span>
        <span className="flex items-center gap-1"><Clock className="size-3 text-amber-500" />{late} late</span>
      </div>
    </div>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────
function MiniHeatmap({ heatmap }: { heatmap: Record<string, number> }) {
  const entries = Object.entries(heatmap).sort(([a], [b]) => a.localeCompare(b)).slice(-28);
  const maxCount = Math.max(...entries.map(([, v]) => v), 1);
  const intensities = ["bg-muted", "bg-primary/20", "bg-primary/40", "bg-primary/70", "bg-primary"];
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">Submission activity (last 28 days)</p>
      <div className="flex flex-wrap gap-1">
        {entries.map(([date, count]) => {
          const level = count === 0 ? 0 : Math.ceil((count / maxCount) * 4);
          return (
            <div
              key={date}
              title={`${date}: ${count} submission${count !== 1 ? "s" : ""}`}
              className={`size-5 rounded-sm ${intensities[level]}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Platform View (Admin / Super Admin) ──────────────────────────────────────
function PlatformView({ data }: { data: Record<string, unknown> }) {
  const topLb = (data.topLeaderboard as Array<{ user: { name: string; role: string }; totalPoints: number; problemsSolved: number }>) ?? [];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Departments" value={Number(data.departmentsCount ?? 0)} icon={Building2} color="info" />
        <StatCard title="Sections" value={Number(data.sectionsCount ?? 0)} icon={Layers} color="purple" />
        <StatCard title="Students" value={Number(data.studentsCount ?? 0)} icon={Users} color="success" />
        <StatCard title="Teachers" value={Number(data.teachersCount ?? 0)} icon={GraduationCap} color="warn" />
        <StatCard title="Active Contests" value={Number(data.activeContests ?? 0)} icon={Trophy} color="primary" />
      </div>

      {topLb.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Award className="size-4 text-amber-500" />Top 10 Leaderboard</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {topLb.map((entry, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-zinc-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{entry.user.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{entry.user.role.toLowerCase().replace("_", " ")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{entry.totalPoints} pts</p>
                    <p className="text-xs text-muted-foreground">{entry.problemsSolved} solved</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Section View (Class Coordinator) ─────────────────────────────────────────
function SectionView({ data }: { data: Record<string, unknown> }) {
  const section = data.section as { name: string; code: string; academicYear?: string } | null;
  const gradeSum = data.gradeSummary as { _avg?: { marks?: number; maxMarks?: number }; _count?: { id: number } } | null;
  const topStudents = (data.topStudents as Array<{ student: { name: string }; totalScore: number; rank?: number }>) ?? [];
  const attendanceSummary = (data.attendanceSummary as Array<{ status: string; _count: number }>) ?? [];
  const enrollments = Number(data.enrollments ?? 0);
  const assignmentCount = (data.assignmentSummary as { _count?: { id: number } } | null)?._count?.id ?? 0;
  const avgMarks = gradeSum?._avg?.marks ?? 0;
  const avgMaxMarks = gradeSum?._avg?.maxMarks ?? 100;
  const avgPct = avgMaxMarks > 0 ? Math.round((avgMarks / avgMaxMarks) * 100) : 0;

  return (
    <div className="space-y-6">
      {section && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="text-sm">{section.name}</Badge>
          <Badge variant="secondary">{section.code}</Badge>
          {section.academicYear && <span className="text-sm text-muted-foreground">{section.academicYear}</span>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Enrolled Students" value={enrollments} icon={Users} color="info" />
        <StatCard title="Assignments" value={assignmentCount} icon={BookOpen} color="purple" />
        <StatCard title="Avg Grade" value={`${avgPct}%`} icon={BarChart3} color="success" sub={`${avgMarks.toFixed(1)}/${avgMaxMarks.toFixed(1)}`} />
        <StatCard title="Grade Entries" value={gradeSum?._count?.id ?? 0} icon={Target} color="warn" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {attendanceSummary.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" />Attendance Overview</CardTitle></CardHeader>
            <CardContent><AttendanceSummary data={attendanceSummary} /></CardContent>
          </Card>
        )}
        {topStudents.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Star className="size-4 text-amber-500" />Top Students</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topStudents.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>{s.rank ?? i + 1}</span>
                      <span className="text-sm font-medium">{s.student.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{s.totalScore.toFixed(1)} pts</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Subject View (Teacher) ────────────────────────────────────────────────────
function SubjectView({ data }: { data: Record<string, unknown> }) {
  const subject = data.subject as { name: string; code: string; section?: { name: string } } | null;
  const gradeSum = data.gradeSummary as { _avg?: { marks?: number; maxMarks?: number }; _count?: { id: number } } | null;
  const attendanceSummary = (data.attendanceSummary as Array<{ status: string; _count: number }>) ?? [];
  const assignmentCount = (data.assignmentSummary as { _count?: { id: number } } | null)?._count?.id ?? 0;
  const enrolledStudents = Number(data.enrolledStudents ?? 0);
  const avgMarks = gradeSum?._avg?.marks ?? 0;
  const avgMaxMarks = gradeSum?._avg?.maxMarks ?? 100;
  const avgPct = avgMaxMarks > 0 ? Math.round((avgMarks / avgMaxMarks) * 100) : 0;

  return (
    <div className="space-y-6">
      {subject && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="text-sm">{subject.name}</Badge>
          <Badge variant="secondary">{subject.code}</Badge>
          {subject.section && <span className="text-sm text-muted-foreground">Section: {subject.section.name}</span>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Enrolled Students" value={enrolledStudents} icon={Users} color="info" />
        <StatCard title="Assignments" value={assignmentCount} icon={BookOpen} color="purple" />
        <StatCard title="Avg Grade" value={`${avgPct}%`} icon={BarChart3} color="success" sub={`${avgMarks.toFixed(1)}/${avgMaxMarks.toFixed(1)}`} />
        <StatCard title="Grade Records" value={gradeSum?._count?.id ?? 0} icon={Target} color="warn" />
      </div>
      {attendanceSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" />Attendance</CardTitle></CardHeader>
          <CardContent><AttendanceSummary data={attendanceSummary} /></CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Student View (Me) ───────────────────────────────────────────────────────
function StudentView({ data }: { data: Record<string, unknown> }) {
  const lb = data.leaderboard as { totalPoints?: number; problemsSolved?: number; rank?: number; contestsParticipated?: number } | null;
  const profile = data.studentProfile as { cgpa?: number | null } | null;
  const submissionsByStatus = (data.submissionsByStatus as Array<{ status: string; _count: number }>) ?? [];
  const heatmap = (data.heatmap as Record<string, number>) ?? {};
  const contestHistory = (data.contestHistory as Array<{ contest: { title: string; startTime: string }; rank?: number | null; totalScore: number }>) ?? [];
  const attendanceByStatus = (data.attendanceByStatus as Array<{ status: string; _count: number }>) ?? [];

  const accepted = submissionsByStatus.find((s) => s.status === "ACCEPTED")?._count ?? 0;
  const total = submissionsByStatus.reduce((acc, s) => acc + s._count, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Points" value={lb?.totalPoints ?? 0} icon={Trophy} color="primary" />
        <StatCard title="Problems Solved" value={lb?.problemsSolved ?? 0} icon={Code2} color="success" sub={`${total > 0 ? Math.round((accepted / total) * 100) : 0}% acceptance`} />
        <StatCard title="Contests" value={lb?.contestsParticipated ?? 0} icon={Activity} color="info" />
        <StatCard title="CGPA" value={profile?.cgpa != null ? profile.cgpa.toFixed(2) : "—"} icon={GraduationCap} color="purple" />
      </div>

      {Object.keys(heatmap).length > 0 && (
        <Card>
          <CardContent className="p-5"><MiniHeatmap heatmap={heatmap} /></CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {submissionsByStatus.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4" />Submission Stats</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {submissionsByStatus.map((s) => (
                <ProgressBar key={s.status} label={s.status.replace(/_/g, " ")} value={s._count} total={total} />
              ))}
            </CardContent>
          </Card>
        )}

        {attendanceByStatus.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" />Overall Attendance</CardTitle></CardHeader>
            <CardContent><AttendanceSummary data={attendanceByStatus} /></CardContent>
          </Card>
        )}
      </div>

      {contestHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Trophy className="size-4 text-amber-500" />Recent Contest History</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border/60 p-0">
            {contestHistory.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{c.contest.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.contest.startTime).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  {c.rank && <Badge variant={c.rank <= 3 ? "secondary" : "outline"}>Rank #{c.rank}</Badge>}
                  <p className="text-xs text-muted-foreground">{c.totalScore} pts</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Department View (Department Head) ─────────────────────────────────────────
function DepartmentView({ data }: { data: Record<string, unknown> }) {
  // Department analytics returns various fields - render what we have
  const entries = Object.entries(data).filter(([, v]) => typeof v !== "object" || v === null);
  const objectEntries = Object.entries(data).filter(([, v]) => typeof v === "object" && v !== null && !Array.isArray(v));
  const arrayEntries = Object.entries(data).filter(([, v]) => Array.isArray(v));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(([key, value]) => (
          <StatCard key={key} title={formatKey(key)} value={String(value ?? "—")} icon={BarChart3} />
        ))}
      </div>
      {objectEntries.map(([key, value]) => (
        <Card key={key}>
          <CardHeader className="pb-3"><CardTitle className="text-base">{formatKey(key)}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{formatKey(k)}</span>
                  <span className="font-medium">{String(v ?? "—")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      {arrayEntries.map(([key, value]) => (
        <Card key={key}>
          <CardHeader className="pb-3"><CardTitle className="text-base">{formatKey(key)}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{(value as unknown[]).length} items</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatKey(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

// ─── Main Page ────────────────────────────────────────────────────────────────
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

  const description = role === Role.ADMIN || role === Role.SUPER_ADMIN
    ? "Platform-wide activity, enrollment counts, and top performers."
    : role === Role.DEPARTMENT_HEAD
      ? "Department-level academic and activity insights."
      : role === Role.CLASS_COORDINATOR
        ? "Section-level classroom insights, attendance, and top students."
        : role === Role.TEACHER
          ? "Subject-level teaching insights for your assigned subject."
          : "Your personal coding performance, attendance, and academic stats.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !data?.data ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-3 size-12 opacity-20" />
            <p>No analytics data available yet.</p>
          </CardContent>
        </Card>
      ) : (role === Role.ADMIN || role === Role.SUPER_ADMIN) ? (
        <PlatformView data={data.data} />
      ) : role === Role.DEPARTMENT_HEAD ? (
        <DepartmentView data={data.data} />
      ) : role === Role.CLASS_COORDINATOR ? (
        <SectionView data={data.data} />
      ) : role === Role.TEACHER ? (
        <SubjectView data={data.data} />
      ) : (
        <StudentView data={data.data} />
      )}
    </div>
  );
}
