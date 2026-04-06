"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { ApiResponse } from "@repo/types";
import { EmptyState } from "@/components/common/page-shell";

interface Teacher {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  subjects: Array<{ id: string; name: string; code: string; sectionName: string }>;
}

export function DepartmentTeachersTab({ departmentId }: { departmentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["department", "teachers", departmentId],
    queryFn: () => api.get<ApiResponse<Teacher[]>>(`/api/departments/${departmentId}/teachers`),
    enabled: !!departmentId,
  });

  const teachers = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  if (teachers.length === 0) {
    return (
      <EmptyState
        title="No teachers assigned"
        description="Teachers will appear here once assigned to subjects in this department."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Teacher</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Assigned Subjects</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher) => (
            <tr key={teacher.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar src={teacher.avatar} name={teacher.name} size="sm" />
                  <p className="text-sm font-medium">{teacher.name}</p>
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">{teacher.email}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {teacher.subjects.map((subject) => (
                    <Badge key={subject.id} variant="outline" className="text-xs">
                      {subject.code} <span className="ml-1 text-muted-foreground">({subject.sectionName})</span>
                    </Badge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
