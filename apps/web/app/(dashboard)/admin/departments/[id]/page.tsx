"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2 } from "lucide-react";
import type { ApiResponse } from "@repo/types";
import { DepartmentOverviewTab } from "@/components/departments/DepartmentOverviewTab";
import { DepartmentSectionsTab } from "@/components/departments/DepartmentSectionsTab";
import { DepartmentTeachersTab } from "@/components/departments/DepartmentTeachersTab";
import { DepartmentStudentsTab } from "@/components/departments/DepartmentStudentsTab";
import { DepartmentContestsTab } from "@/components/departments/DepartmentContestsTab";
import { DepartmentHackathonsTab } from "@/components/departments/DepartmentHackathonsTab";
import { DepartmentLeaderboardTab } from "@/components/departments/DepartmentLeaderboardTab";

interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  head?: { id: string; name: string; email: string } | null;
  stats?: { sectionsCount: number; studentsCount: number; teachersCount: number; activeContests: number };
}

export default function DepartmentDashboardPage() {
  const params = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["department", params.id],
    queryFn: () => api.get<ApiResponse<Department>>(`/api/departments/${params.id}`),
    enabled: !!params.id,
  });

  const dept = data?.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/departments">
            <ArrowLeft className="mr-2 size-4" />
            Departments
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="size-6 text-primary" />
          </div>
          <div>
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-48 mb-1" />
                <Skeleton className="h-4 w-24" />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight">{dept?.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="font-mono text-xs">{dept?.code}</Badge>
                  {dept?.head && (
                    <span className="text-sm text-muted-foreground">Head: {dept.head.name}</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="contests">Contests</TabsTrigger>
          <TabsTrigger value="hackathons">Hackathons</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <DepartmentOverviewTab departmentId={params.id} />
        </TabsContent>
        <TabsContent value="sections" className="mt-6">
          <DepartmentSectionsTab departmentId={params.id} />
        </TabsContent>
        <TabsContent value="teachers" className="mt-6">
          <DepartmentTeachersTab departmentId={params.id} />
        </TabsContent>
        <TabsContent value="students" className="mt-6">
          <DepartmentStudentsTab departmentId={params.id} />
        </TabsContent>
        <TabsContent value="contests" className="mt-6">
          <DepartmentContestsTab departmentId={params.id} />
        </TabsContent>
        <TabsContent value="hackathons" className="mt-6">
          <DepartmentHackathonsTab departmentId={params.id} />
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-6">
          <DepartmentLeaderboardTab departmentId={params.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
