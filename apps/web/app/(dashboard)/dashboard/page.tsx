"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Role,
  type ApiResponse,
  type LeaderboardScopedEntry,
  type LeaderboardScopedResponse,
} from "@repo/types";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PageContainer, PageHeader, SectionCard } from "@/components/common/page-shell";
import { MetricCard } from "@/components/common/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Award,
  BarChart3,
  Brain,
  BookOpen,
  Building2,
  ClipboardList,
  Code2,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

type LeaderboardFilterValue = "overall" | "coding" | "academic" | "profile" | "external";
type LeaderboardScopeValue = "global" | "department" | "section";

interface LeaderboardSection {
  id: string;
  name: string;
  code: string;
}

interface LeaderboardExtendedEntry extends LeaderboardScopedEntry {
  section?: LeaderboardSection | null;
}

interface LeaderboardBreakdownResponse
  extends Omit<LeaderboardScopedResponse, "items" | "self"> {
  items: LeaderboardExtendedEntry[];
  self?: LeaderboardExtendedEntry | null;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface SectionOption {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  department: {
    id: string;
    name: string;
    code: string;
  };
}

interface StudentAnalyticsData {
  leaderboard: {
    totalPoints: number;
    rank?: number | null;
    sectionRank?: number | null;
    departmentRank?: number | null;
    problemsSolved: number;
    contestsParticipated: number;
    currentStreak: number;
  } | null;
  studentSummary?: {
    section?: { id: string; name: string; code: string } | null;
    department?: { id: string; name: string; code: string } | null;
    avatar?: string | null;
    student?: LeaderboardExtendedEntry | null;
  } | null;
  submissionsByStatus: { status: string; _count: number }[];
}

interface SkillGraphData {
  skills: Array<{ key: string; label: string; score: number; trend: number }>;
  summary: {
    activityScore: number;
    consistencyScore: number;
    strongestSkills: Array<{ key: string; label: string; score: number; trend: number }>;
    weakestSkills: Array<{ key: string; label: string; score: number; trend: number }>;
  };
  history: Array<{
    date: string;
    activityScore: number;
    consistencyScore: number;
  }>;
  coachAdvice: {
    warning: string;
    motivation: string;
    tasks: string[];
    source: string;
    createdAt: string;
  } | null;
}

interface PlatformAnalyticsData {
  departmentsCount: number;
  sectionsCount: number;
  studentsCount: number;
  teachersCount: number;
  activeContests: number;
  topLeaderboard: Array<{
    studentId: string;
    totalScore: number;
    student: { id: string; name: string; avatar?: string | null };
  }>;
}

interface DepartmentAnalyticsData {
  sectionsCount: number;
  studentsCount: number;
  teachersCount: number;
  activeContests: number;
  attendanceSummary: Array<{ sectionId: string; sectionName: string; todayAttendancePercentage: number }>;
}

interface SectionAnalyticsData {
  enrollments: number;
  attendanceSummary: Array<{ status: string; _count: number }>;
  assignmentSummary: { _count: { id: number } };
  topStudents: Array<{ id: string; rank?: number | null; totalScore: number; student: { name: string } }>;
}

interface SubjectAnalyticsData {
  subject: {
    id: string;
    name: string;
    code: string;
    section: { id: string; name: string; code: string; academicYear: string };
    department: { id: string; name: string; code: string };
  };
  attendanceSummary: Array<{ status: string; _count: number }>;
  assignmentSummary: { _count: { id: number } };
  gradeSummary: { _avg: { marks: number | null; maxMarks: number | null }; _count: { id: number } };
  enrolledStudents: number;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const departmentId = user?.scope.primaryDepartmentId ?? null;
  const sectionId = user?.scope.primarySectionId ?? null;
  const teacherSectionId = user?.teachingAssignments?.[0]?.sectionId ?? null;
  const teacherSubjectId = user?.teachingAssignments?.[0]?.subjectId ?? null;

  const isStudent = role === Role.STUDENT;
  const isDepartmentHead = role === Role.DEPARTMENT_HEAD;
  const isClassCoordinator = role === Role.CLASS_COORDINATOR;
  const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;

  const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilterValue>("overall");
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [departmentSectionFilter, setDepartmentSectionFilter] = useState<string>("all");
  const [adminScope, setAdminScope] = useState<LeaderboardScopeValue>("global");
  const [adminDepartmentId, setAdminDepartmentId] = useState<string>("");
  const [adminSectionId, setAdminSectionId] = useState<string>("");

  const { data: studentData, isLoading: studentLoading } = useQuery({
    queryKey: ["dashboard", "student"],
    queryFn: () => api.get<ApiResponse<StudentAnalyticsData>>("/api/analytics/me"),
    enabled: role === Role.STUDENT,
  });

  const { data: studentSkillData, isLoading: studentSkillLoading } = useQuery({
    queryKey: ["dashboard", "student-skills"],
    queryFn: () => api.get<ApiResponse<SkillGraphData>>("/api/analytics/me/skills?days=30"),
    enabled: role === Role.STUDENT,
  });

  const { data: platformData, isLoading: platformLoading } = useQuery({
    queryKey: ["dashboard", "platform"],
    queryFn: () => api.get<ApiResponse<PlatformAnalyticsData>>("/api/analytics/platform"),
    enabled: role === Role.ADMIN || role === Role.SUPER_ADMIN,
  });

  const { data: departmentData, isLoading: departmentLoading } = useQuery({
    queryKey: ["dashboard", "department", departmentId],
    queryFn: () => api.get<ApiResponse<DepartmentAnalyticsData>>(`/api/departments/${departmentId}/analytics`),
    enabled: role === Role.DEPARTMENT_HEAD && !!departmentId,
  });

  const { data: sectionData, isLoading: sectionLoading } = useQuery({
    queryKey: ["dashboard", "section", sectionId],
    queryFn: () => api.get<ApiResponse<SectionAnalyticsData>>(`/api/analytics/section/${sectionId}`),
    enabled: role === Role.CLASS_COORDINATOR && !!sectionId,
  });

  const { data: subjectData, isLoading: subjectLoading } = useQuery({
    queryKey: ["dashboard", "subject", teacherSubjectId],
    queryFn: () => api.get<ApiResponse<SubjectAnalyticsData>>(`/api/analytics/subject/${teacherSubjectId}`),
    enabled: role === Role.TEACHER && !!teacherSubjectId,
  });

  const { data: departmentOptionsData } = useQuery({
    queryKey: ["dashboard", "department-options"],
    queryFn: () => api.get<ApiResponse<DepartmentOption[]>>("/api/departments"),
    enabled: isAdmin,
  });

  const { data: sectionOptionsData } = useQuery({
    queryKey: ["dashboard", "section-options"],
    queryFn: () => api.get<ApiResponse<SectionOption[]>>("/api/sections"),
    enabled: isAdmin,
  });

  const departmentOptions = departmentOptionsData?.data ?? [];
  const sectionOptions = sectionOptionsData?.data ?? [];

  const effectiveAdminDepartmentId = useMemo(() => {
    if (adminDepartmentId && departmentOptions.some((department) => department.id === adminDepartmentId)) {
      return adminDepartmentId;
    }
    return departmentOptions[0]?.id ?? "";
  }, [adminDepartmentId, departmentOptions]);

  const scopedAdminSections = useMemo(() => {
    if (!effectiveAdminDepartmentId) {
      return sectionOptions;
    }
    return sectionOptions.filter((section) => section.departmentId === effectiveAdminDepartmentId);
  }, [effectiveAdminDepartmentId, sectionOptions]);

  const effectiveAdminSectionId = useMemo(() => {
    if (adminSectionId && scopedAdminSections.some((section) => section.id === adminSectionId)) {
      return adminSectionId;
    }
    return scopedAdminSections[0]?.id ?? "";
  }, [adminSectionId, scopedAdminSections]);

  const leaderboardSearchTerm = leaderboardSearch.trim();

  const leaderboardRequest = useMemo(() => {
    const baseQuery = `page=1&limit=5000&filter=${leaderboardFilter}`;
    const queryWithSearch = leaderboardSearchTerm
      ? `${baseQuery}&search=${encodeURIComponent(leaderboardSearchTerm)}`
      : baseQuery;

    if (isStudent && sectionId) {
      return {
        endpoint: `/api/leaderboard/section/${sectionId}?${queryWithSearch}`,
        enabled: true,
        title: "Class leaderboard points breakdown",
        description: "See how each score component contributes to your section ranking.",
      };
    }

    if (isClassCoordinator && sectionId) {
      return {
        endpoint: `/api/leaderboard/section/${sectionId}?${queryWithSearch}`,
        enabled: true,
        title: "Section leaderboard points breakdown",
        description: "Track every student with score-category level transparency.",
      };
    }

    if (isDepartmentHead && departmentId) {
      return {
        endpoint: `/api/leaderboard/department/${departmentId}?${queryWithSearch}`,
        enabled: true,
        title: "Department leaderboard points breakdown",
        description: "Review all department students and filter down to specific sections.",
      };
    }

    if (isAdmin) {
      if (adminScope === "global") {
        return {
          endpoint: "/api/leaderboard/global?page=1&limit=5000",
          enabled: true,
          title: "Platform leaderboard points breakdown",
          description: "Switch scopes and filters to inspect student performance at any level.",
        };
      }

      if (adminScope === "department" && effectiveAdminDepartmentId) {
        return {
          endpoint: `/api/leaderboard/department/${effectiveAdminDepartmentId}?${queryWithSearch}`,
          enabled: true,
          title: "Platform leaderboard points breakdown",
          description: "Department-scoped leaderboard with component-level score insights.",
        };
      }

      if (adminScope === "section" && effectiveAdminSectionId) {
        return {
          endpoint: `/api/leaderboard/section/${effectiveAdminSectionId}?${queryWithSearch}`,
          enabled: true,
          title: "Platform leaderboard points breakdown",
          description: "Section-scoped leaderboard with component-level score insights.",
        };
      }
    }

    if (role === Role.TEACHER && teacherSectionId) {
      return {
        endpoint: `/api/leaderboard/section/${teacherSectionId}?${queryWithSearch}`,
        enabled: true,
        title: "Section leaderboard points breakdown",
        description: "Track section score distribution while planning interventions.",
      };
    }

    return {
      endpoint: "",
      enabled: false,
      title: "Leaderboard points breakdown",
      description: "",
    };
  }, [
    adminScope,
    effectiveAdminDepartmentId,
    effectiveAdminSectionId,
    isAdmin,
    isClassCoordinator,
    isDepartmentHead,
    isStudent,
    leaderboardFilter,
    leaderboardSearchTerm,
    role,
    sectionId,
    departmentId,
    teacherSectionId,
  ]);

  const { data: leaderboardBreakdownData, isLoading: leaderboardBreakdownLoading } = useQuery({
    queryKey: [
      "dashboard",
      "leaderboard-breakdown",
      role,
      leaderboardRequest.endpoint,
      leaderboardFilter,
      leaderboardSearchTerm,
      adminScope,
      effectiveAdminDepartmentId,
      effectiveAdminSectionId,
      departmentSectionFilter,
    ],
    queryFn: () =>
      api.get<ApiResponse<LeaderboardBreakdownResponse>>(leaderboardRequest.endpoint),
    enabled: leaderboardRequest.enabled,
  });

  const rawLeaderboardItems = leaderboardBreakdownData?.data?.items ?? [];

  const departmentSectionOptions = useMemo(() => {
    const sectionMap = new Map<string, LeaderboardSection>();
    for (const entry of rawLeaderboardItems) {
      if (entry.section?.id && !sectionMap.has(entry.section.id)) {
        sectionMap.set(entry.section.id, entry.section);
      }
    }
    return Array.from(sectionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawLeaderboardItems]);

  const filteredLeaderboardItems = useMemo(() => {
    let items = [...rawLeaderboardItems];

    if (isDepartmentHead && departmentSectionFilter !== "all") {
      items = items.filter((entry) => entry.section?.id === departmentSectionFilter);
    }

    if (isAdmin && adminScope === "global") {
      if (leaderboardSearchTerm) {
        const lowered = leaderboardSearchTerm.toLowerCase();
        items = items.filter((entry) => {
          const studentName = entry.student.name.toLowerCase();
          const github = (entry.student.githubUsername ?? "").toLowerCase();
          const sectionName = (entry.section?.name ?? "").toLowerCase();
          const sectionCode = (entry.section?.code ?? "").toLowerCase();
          return (
            studentName.includes(lowered) ||
            github.includes(lowered) ||
            sectionName.includes(lowered) ||
            sectionCode.includes(lowered)
          );
        });
      }

      if (leaderboardFilter !== "overall") {
        items = items.sort((a, b) => {
          const metricDiff = getLeaderboardMetric(b, leaderboardFilter) - getLeaderboardMetric(a, leaderboardFilter);
          if (metricDiff !== 0) {
            return metricDiff;
          }
          return a.student.name.localeCompare(b.student.name);
        });
      }
    }

    return items;
  }, [
    rawLeaderboardItems,
    isDepartmentHead,
    departmentSectionFilter,
    isAdmin,
    adminScope,
    leaderboardFilter,
    leaderboardSearchTerm,
  ]);

  const studentBreakdownEntry = useMemo(() => {
    if (!isStudent) {
      return null;
    }

    return (
      studentData?.data?.studentSummary?.student ??
      leaderboardBreakdownData?.data?.self ??
      filteredLeaderboardItems.find((entry) => entry.userId === user?.id) ??
      null
    );
  }, [isStudent, studentData, leaderboardBreakdownData, filteredLeaderboardItems, user?.id]);

  const showSectionColumn = useMemo(
    () =>
      isDepartmentHead ||
      isAdmin ||
      filteredLeaderboardItems.some((entry) => Boolean(entry.section?.id)),
    [filteredLeaderboardItems, isDepartmentHead, isAdmin]
  );

  const useDerivedRank = isAdmin && adminScope === "global" && leaderboardFilter !== "overall";
  const breakdownEmpty = !leaderboardBreakdownLoading && filteredLeaderboardItems.length === 0;

  return (
    <PageContainer>
      <SectionCard className="p-6 sm:p-8">
        <PageHeader
          eyebrow="Workspace"
          title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}.`}
          description={getRoleDescription(role)}
          actions={
            <Button asChild>
              <Link href={getPrimaryLink(role)}>
                Open primary workflow
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
      </SectionCard>

      {role === Role.STUDENT ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Total points" value={studentData?.data?.leaderboard?.totalPoints ?? 0} icon={Trophy} loading={studentLoading} />
            <MetricCard title="Problems solved" value={studentData?.data?.leaderboard?.problemsSolved ?? 0} icon={Code2} loading={studentLoading} />
            <MetricCard title="Global rank" value={studentData?.data?.leaderboard?.rank ? `#${studentData.data.leaderboard.rank}` : "Unranked"} icon={Award} loading={studentLoading} />
            <MetricCard title="Current streak" value={studentData?.data?.leaderboard?.currentStreak ?? 0} icon={ClipboardList} loading={studentLoading} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Your academic snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-xl border border-border bg-muted/20 p-4 xl:col-span-2">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Student</p>
                <div className="mt-3 flex min-w-0 items-center gap-3">
                  <div
                    className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-sm font-semibold"
                    style={
                      studentData?.data?.studentSummary?.avatar
                        ? {
                            backgroundImage: `url(${studentData.data.studentSummary.avatar})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    {!studentData?.data?.studentSummary?.avatar ? user?.name?.slice(0, 2).toUpperCase() : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user?.name}</p>
                    <p className="break-all text-sm text-muted-foreground">
                      {studentData?.data?.studentSummary?.student?.student.githubUsername
                        ? `github.com/${studentData.data.studentSummary.student.student.githubUsername}`
                        : user?.email}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Section</p>
                    <p className="mt-3 break-words text-3xl font-semibold leading-tight">
                      {studentData?.data?.studentSummary?.section?.name ?? "Not assigned"}
                    </p>
                  </div>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted/70">
                    <BookOpen className="size-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="mt-3 break-words text-3xl font-semibold leading-tight">
                      {studentData?.data?.studentSummary?.department?.name ?? "Not assigned"}
                    </p>
                  </div>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted/70">
                    <Building2 className="size-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 xl:col-span-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Section rank</p>
                    <p className="mt-3 text-3xl font-semibold leading-tight">
                      {studentData?.data?.leaderboard?.sectionRank ? `#${studentData.data.leaderboard.sectionRank}` : "Unranked"}
                    </p>
                  </div>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted/70">
                    <Award className="size-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 xl:col-span-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Department rank</p>
                    <p className="mt-3 text-3xl font-semibold leading-tight">
                      {studentData?.data?.leaderboard?.departmentRank ? `#${studentData.data.leaderboard.departmentRank}` : "Unranked"}
                    </p>
                  </div>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted/70">
                    <Users className="size-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {studentBreakdownEntry ? (
            <Card>
              <CardHeader>
                <CardTitle>Your leaderboard points breakdown</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard title="Coding" value={studentBreakdownEntry.codingScore.toFixed(2)} icon={Code2} />
                <MetricCard title="CGPA" value={studentBreakdownEntry.cgpaScore.toFixed(2)} icon={Award} />
                <MetricCard title="Assignments" value={studentBreakdownEntry.assignmentScore.toFixed(2)} icon={ClipboardList} />
                <MetricCard title="Hackathons" value={studentBreakdownEntry.hackathonScore.toFixed(2)} icon={Trophy} />
                <MetricCard title="Profile" value={studentBreakdownEntry.profileScore.toFixed(2)} icon={Users} />
                <MetricCard title="External" value={studentBreakdownEntry.externalScore.toFixed(2)} icon={BarChart3} />
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="size-4" />
                  Skill graph
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {studentSkillLoading ? (
                  <div className="h-72 animate-pulse rounded-xl bg-muted/40" />
                ) : studentSkillData?.data?.skills?.length ? (
                  <>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={studentSkillData.data.skills.slice(0, 8)}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <Radar dataKey="score" stroke="#f97316" fill="#f97316" fillOpacity={0.35} />
                          <RechartsTooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetricCard title="Activity score" value={studentSkillData.data.summary.activityScore.toFixed(1)} icon={BarChart3} />
                      <MetricCard title="Consistency score" value={studentSkillData.data.summary.consistencyScore.toFixed(1)} icon={Trophy} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Solve tagged problems and sync your profiles to unlock your skill graph.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Growth and coach</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {studentSkillLoading ? (
                  <div className="space-y-3">
                    <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
                    <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
                  </div>
                ) : (
                  <>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={studentSkillData?.data?.history ?? []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RechartsTooltip />
                          <Line type="monotone" dataKey="activityScore" stroke="#f97316" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="consistencyScore" stroke="#22c55e" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {studentSkillData?.data?.coachAdvice ? (
                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <p className="text-sm font-semibold">{studentSkillData.data.coachAdvice.warning}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{studentSkillData.data.coachAdvice.motivation}</p>
                        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                          {studentSkillData.data.coachAdvice.tasks.map((task) => (
                            <p key={task}>• {task}</p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Daily coach advice will appear here once enough activity is available.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {(role === Role.ADMIN || role === Role.SUPER_ADMIN) && platformData?.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Departments" value={platformData.data.departmentsCount} icon={Building2} loading={platformLoading} />
            <MetricCard title="Classes" value={platformData.data.sectionsCount} icon={BookOpen} loading={platformLoading} />
            <MetricCard title="Students" value={platformData.data.studentsCount} icon={Users} loading={platformLoading} />
            <MetricCard title="Faculty" value={platformData.data.teachersCount} icon={Users} loading={platformLoading} />
            <MetricCard title="Active contests" value={platformData.data.activeContests} icon={Trophy} loading={platformLoading} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Platform leaderboard preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {platformData.data.topLeaderboard.map((entry, index) => (
                <div key={entry.studentId} className="flex items-center justify-between border border-border px-4 py-3">
                  <p className="font-medium">#{index + 1} {entry.student.name}</p>
                  <Badge variant="outline">{entry.totalScore.toFixed(2)} pts</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {role === Role.DEPARTMENT_HEAD && departmentData?.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Sections" value={departmentData.data.sectionsCount} icon={BookOpen} loading={departmentLoading} />
            <MetricCard title="Students" value={departmentData.data.studentsCount} icon={Users} loading={departmentLoading} />
            <MetricCard title="Teachers" value={departmentData.data.teachersCount} icon={Users} loading={departmentLoading} />
            <MetricCard title="Active contests" value={departmentData.data.activeContests} icon={Trophy} loading={departmentLoading} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Attendance activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {departmentData.data.attendanceSummary.map((section) => (
                <div key={section.sectionId} className="flex items-center justify-between border border-border px-4 py-3">
                  <p className="font-medium">{section.sectionName}</p>
                  <Badge variant="outline">{section.todayAttendancePercentage}% today</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {role === Role.CLASS_COORDINATOR && sectionData?.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Enrolled students" value={sectionData.data.enrollments} icon={Users} loading={sectionLoading} />
            <MetricCard title="Assignments" value={sectionData.data.assignmentSummary?._count.id ?? 0} icon={ClipboardList} loading={sectionLoading} />
            <MetricCard title="Attendance marks" value={sectionData.data.attendanceSummary.reduce((sum, item) => sum + item._count, 0)} icon={BarChart3} loading={sectionLoading} />
            <MetricCard title="Top students tracked" value={sectionData.data.topStudents.length} icon={Award} loading={sectionLoading} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Section leaderboard preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sectionData.data.topStudents.map((entry, index) => (
                <div key={entry.id} className="flex items-center justify-between border border-border px-4 py-3">
                  <p className="font-medium">#{entry.rank ?? index + 1} {entry.student.name}</p>
                  <Badge variant="outline">{entry.totalScore.toFixed(1)} score</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {role === Role.TEACHER && subjectData?.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Subject" value={subjectData.data.subject.code} icon={BookOpen} loading={subjectLoading} />
            <MetricCard title="Enrolled students" value={subjectData.data.enrolledStudents} icon={Users} loading={subjectLoading} />
            <MetricCard title="Assignments" value={subjectData.data.assignmentSummary?._count.id ?? 0} icon={ClipboardList} loading={subjectLoading} />
            <MetricCard title="Assessments" value={subjectData.data.gradeSummary?._count.id ?? 0} icon={Award} loading={subjectLoading} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Subject activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between border border-border px-4 py-3">
                <p className="font-medium">Average marks</p>
                <Badge variant="outline">
                  {subjectData.data.gradeSummary._avg.marks?.toFixed(1) ?? "0.0"} /{" "}
                  {subjectData.data.gradeSummary._avg.maxMarks?.toFixed(1) ?? "0.0"}
                </Badge>
              </div>
              {subjectData.data.attendanceSummary.map((entry) => (
                <div key={entry.status} className="flex items-center justify-between border border-border px-4 py-3">
                  <p className="font-medium">{entry.status.replaceAll("_", " ")}</p>
                  <Badge variant="outline">{entry._count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {leaderboardRequest.enabled ? (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-2">
              <CardTitle>{leaderboardRequest.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{leaderboardRequest.description}</p>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
              {isAdmin ? (
                <Select value={adminScope} onValueChange={(value) => setAdminScope(value as LeaderboardScopeValue)}>
                  <SelectTrigger className="w-full sm:w-42.5">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Platform scope</SelectItem>
                    <SelectItem value="department">Department scope</SelectItem>
                    <SelectItem value="section">Section scope</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}

              {isAdmin && adminScope === "department" ? (
                <Select
                  value={adminDepartmentId || effectiveAdminDepartmentId}
                  onValueChange={setAdminDepartmentId}
                >
                  <SelectTrigger className="w-full sm:w-55">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.code} - {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {isAdmin && adminScope === "section" ? (
                <Select value={adminSectionId || effectiveAdminSectionId} onValueChange={setAdminSectionId}>
                  <SelectTrigger className="w-full sm:w-60">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {scopedAdminSections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.code} - {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Select
                value={leaderboardFilter}
                onValueChange={(value) => setLeaderboardFilter(value as LeaderboardFilterValue)}
              >
                <SelectTrigger className="w-full sm:w-45">
                  <SelectValue placeholder="Metric filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overall">Overall score</SelectItem>
                  <SelectItem value="coding">Coding score</SelectItem>
                  <SelectItem value="academic">Academic score</SelectItem>
                  <SelectItem value="profile">Profile score</SelectItem>
                  <SelectItem value="external">External score</SelectItem>
                </SelectContent>
              </Select>

              {isDepartmentHead ? (
                <Select value={departmentSectionFilter} onValueChange={setDepartmentSectionFilter}>
                  <SelectTrigger className="w-full sm:w-55">
                    <SelectValue placeholder="Section filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sections</SelectItem>
                    {departmentSectionOptions.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.code} - {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={leaderboardSearch}
                  onChange={(event) => setLeaderboardSearch(event.target.value)}
                  placeholder="Search student, section, or GitHub username"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {leaderboardBreakdownLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-12 rounded-xl border border-border/70 bg-muted/20" />
                ))}
              </div>
            ) : breakdownEmpty ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No leaderboard entries match your current filters.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="min-w-280 w-full divide-y divide-border/70 text-sm">
                  <thead className="bg-muted/20">
                    <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Student</th>
                      {showSectionColumn ? <th className="px-4 py-3">Section</th> : null}
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Coding</th>
                      <th className="px-4 py-3 text-right">CGPA</th>
                      <th className="px-4 py-3 text-right">Assignment</th>
                      <th className="px-4 py-3 text-right">Hackathon</th>
                      <th className="px-4 py-3 text-right">Profile</th>
                      <th className="px-4 py-3 text-right">External</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {filteredLeaderboardItems.map((entry, index) => (
                      <tr key={entry.userId} className="hover:bg-muted/15">
                        <td className="px-4 py-3 font-semibold">
                          #{useDerivedRank ? index + 1 : (entry.rank ?? index + 1)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{entry.student.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.student.githubUsername
                              ? `github.com/${entry.student.githubUsername}`
                              : "No GitHub linked"}
                          </p>
                        </td>
                        {showSectionColumn ? (
                          <td className="px-4 py-3">
                            {entry.section ? (
                              <Badge variant="outline" className="rounded-full">
                                {entry.section.code}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-right font-semibold">{entry.totalScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{entry.codingScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{entry.cgpaScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{entry.assignmentScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{entry.hackathonScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{entry.profileScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{entry.externalScore.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </PageContainer>
  );
}

function getLeaderboardMetric(entry: LeaderboardExtendedEntry, filter: LeaderboardFilterValue) {
  if (filter === "coding") return entry.codingScore;
  if (filter === "academic") return entry.cgpaScore + entry.assignmentScore + entry.hackathonScore;
  if (filter === "profile") return entry.profileScore;
  if (filter === "external") return entry.externalScore;
  return entry.totalScore;
}

function getRoleDescription(role: Role | null | undefined) {
  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
    return "Platform-wide controls, academic structure, user governance, and system activity are available from here.";
  }
  if (role === Role.DEPARTMENT_HEAD) {
    return "Monitor section health, department participation, and active academic workflows for your department.";
  }
  if (role === Role.CLASS_COORDINATOR || role === Role.TEACHER) {
    return "Track your section, assignments, attendance, and contests from one teaching dashboard.";
  }
  return "Track coding progress, assignments, attendance, and your personal performance in one place.";
}

function getPrimaryLink(role: Role | null | undefined) {
  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) return "/admin/users";
  if (role === Role.DEPARTMENT_HEAD) return "/department/overview";
  if (role === Role.CLASS_COORDINATOR || role === Role.TEACHER) return "/attendance/mark";
  return "/problems";
}
