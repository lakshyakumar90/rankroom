"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Role, type ApiResponse } from "@repo/types";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PageContainer, PageHeader, SectionCard } from "@/components/common/page-shell";
import { MetricCard } from "@/components/common/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Award, BarChart3, BookOpen, Building2, ClipboardList, Code2, Trophy, Users } from "lucide-react";

interface StudentAnalyticsData {
  leaderboard: {
    totalPoints: number;
    rank?: number | null;
    problemsSolved: number;
    contestsParticipated: number;
  } | null;
  submissionsByStatus: { status: string; _count: number }[];
}

interface PlatformAnalyticsData {
  departmentsCount: number;
  sectionsCount: number;
  studentsCount: number;
  teachersCount: number;
  activeContests: number;
  topLeaderboard: Array<{
    id: string;
    totalPoints: number;
    user: { id: string; name: string; avatar?: string | null };
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
  const teacherSubjectId = user?.teachingAssignments?.[0]?.subjectId ?? null;

  const { data: studentData, isLoading: studentLoading } = useQuery({
    queryKey: ["dashboard", "student"],
    queryFn: () => api.get<ApiResponse<StudentAnalyticsData>>("/api/analytics/me"),
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total points" value={studentData?.data?.leaderboard?.totalPoints ?? 0} icon={Trophy} loading={studentLoading} />
          <MetricCard title="Problems solved" value={studentData?.data?.leaderboard?.problemsSolved ?? 0} icon={Code2} loading={studentLoading} />
          <MetricCard title="Rank" value={studentData?.data?.leaderboard?.rank ? `#${studentData.data.leaderboard.rank}` : "Unranked"} icon={Award} loading={studentLoading} />
          <MetricCard title="Contests" value={studentData?.data?.leaderboard?.contestsParticipated ?? 0} icon={ClipboardList} loading={studentLoading} />
        </div>
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
                <div key={entry.id} className="flex items-center justify-between border border-border px-4 py-3">
                  <p className="font-medium">#{index + 1} {entry.user.name}</p>
                  <Badge variant="outline">{entry.totalPoints} pts</Badge>
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
    </PageContainer>
  );
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
