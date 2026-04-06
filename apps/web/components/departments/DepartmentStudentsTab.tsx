"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Search } from "lucide-react";
import type { ApiResponse } from "@repo/types";
import { EmptyState } from "@/components/common/page-shell";

interface StudentEnrollment {
  student: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    studentProfile?: { cgpa?: number | null; leetcodeSolved?: number | null } | null;
  };
  section: { id: string; name: string; code: string };
}

export function DepartmentStudentsTab({ departmentId }: { departmentId: string }) {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["department", "students", departmentId, search],
    queryFn: () =>
      api.get<ApiResponse<StudentEnrollment[]>>(
        `/api/departments/${departmentId}/students${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
    enabled: !!departmentId,
  });

  const students = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search students..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : students.length === 0 ? (
        <EmptyState title="No students found" description="Try a different search term." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Section</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">CGPA</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">LeetCode</th>
              </tr>
            </thead>
            <tbody>
              {students.map((enrollment) => (
                <tr
                  key={enrollment.student.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={enrollment.student.avatar} name={enrollment.student.name} size="sm" />
                      <p className="text-sm font-medium">{enrollment.student.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">
                    {enrollment.student.email}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs font-mono">{enrollment.section.code}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm">
                    {enrollment.student.studentProfile?.cgpa ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm">
                    {enrollment.student.studentProfile?.leetcodeSolved ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
