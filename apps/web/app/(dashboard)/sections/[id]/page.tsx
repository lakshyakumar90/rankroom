"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, GraduationCap } from "lucide-react";
import type { ApiResponse } from "@repo/types";
import { SectionOverviewTab } from "@/components/sections/SectionOverviewTab";
import { SectionStudentsTab } from "@/components/sections/SectionStudentsTab";
import { SectionSubjectsTab } from "@/components/sections/SectionSubjectsTab";
import { SectionContestsTab } from "@/components/sections/SectionContestsTab";
import { SectionLeaderboardTab } from "@/components/sections/SectionLeaderboardTab";
import { ManageCoordinatorsDialog } from "@/components/sections/ManageCoordinatorsDialog";
import { ManageTeachersDialog } from "@/components/sections/ManageTeachersDialog";
import { useCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

interface SectionOverview {
  id: string;
  name: string;
  code: string;
  semester: number;
  academicYear: string;
  department: { id: string; name: string };
  coordinator?: { id: string; name: string } | null;
  coordinators?: Array<{ id: string; name: string }>;
  stats: { enrollmentCount: number; subjectCount: number; teacherCount: number; coordinatorCount: number };
}

export default function SectionDashboardPage() {
  const params = useParams<{ id: string }>();
  const { user } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["section", params.id],
    queryFn: () => api.get<ApiResponse<SectionOverview>>(`/api/sections/${params.id}`),
    enabled: !!params.id,
  });

  const section = data?.data;
  const canManageCoordinators = user && hasPermission(user.role, "sections:assign-coordinator");
  const canManageTeachers = user && hasPermission(user.role, "sections:assign-teacher");

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sections">
            <ArrowLeft className="mr-1 size-4" />
            Sections
          </Link>
        </Button>
        {section?.department && (
          <>
            <span className="text-muted-foreground">/</span>
            <Link
              href={`/admin/departments/${section.department.id}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {section.department.name}
            </Link>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="size-6 text-primary" />
          </div>
          <div>
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-48 mb-1" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">{section?.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline" className="font-mono text-xs">{section?.code}</Badge>
                  <Badge variant="secondary" className="text-xs">Sem {section?.semester}</Badge>
                  <span className="text-xs text-muted-foreground">{section?.academicYear}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Management actions */}
        {(canManageCoordinators || canManageTeachers) && section && (
          <div className="flex gap-2">
            {canManageCoordinators && (
              <ManageCoordinatorsDialog sectionId={params.id} sectionName={section.name} />
            )}
            {canManageTeachers && (
              <ManageTeachersDialog sectionId={params.id} />
            )}
          </div>
        )}
      </div>

      {/* Dashboard tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="contests">Contests</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {section && <SectionOverviewTab section={section} />}
        </TabsContent>
        <TabsContent value="students" className="mt-6">
          <SectionStudentsTab sectionId={params.id} />
        </TabsContent>
        <TabsContent value="subjects" className="mt-6">
          <SectionSubjectsTab sectionId={params.id} />
        </TabsContent>
        <TabsContent value="attendance" className="mt-6">
          <p className="text-sm text-muted-foreground py-4">Attendance details are in the Attendance module.</p>
        </TabsContent>
        <TabsContent value="contests" className="mt-6">
          <SectionContestsTab sectionId={params.id} />
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-6">
          <SectionLeaderboardTab sectionId={params.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
