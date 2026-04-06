"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, BarChart3 } from "lucide-react";
import type { ApiResponse } from "@repo/types";
import { EmptyState } from "@/components/common/page-shell";
import { useCurrentUser } from "@/lib/auth";
import { StudentPerformancePanel } from "@/components/students/StudentPerformancePanel";

interface SectionStudent {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  rollNo?: string | null;
  attendancePct?: number | null;
  averageMarks?: number | null;
  codingXP?: number | null;
  rank?: number | null;
  studentProfile?: {
    cgpa?: number | null;
    leetcodeSolved?: number | null;
  } | null;
}

export function SectionStudentsTab({ sectionId }: { sectionId: string }) {
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const { user } = useCurrentUser();

  const isTeacher = user?.role === "TEACHER";
  // Teachers see all students in the section (they need context even if only teaching one subject)
  // The backend already scopes to their assigned sections via requireScope
  const { data, isLoading } = useQuery({
    queryKey: ["section", sectionId, "students"],
    queryFn: () => api.get<ApiResponse<SectionStudent[]>>(`/api/sections/${sectionId}/students`),
    enabled: !!sectionId,
  });

  // If teacher, show a note about scope
  const teacherNote = isTeacher ? "Showing students in sections you teach" : null;

  // CC, Admin, Dept-head can drill into individual student performance
  const canViewPerformance = ["ADMIN", "SUPER_ADMIN", "CLASS_COORDINATOR", "DEPARTMENT_HEAD"].includes(user?.role ?? "");

  const allStudents = data?.data ?? [];
  const students = search
    ? allStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase()) ||
          (s.rollNo ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : allStudents;

  return (
    <div className="space-y-4">
      {teacherNote && (
        <p className="text-xs text-muted-foreground">{teacherNote}</p>
      )}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or roll no..."
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
        <EmptyState title="No students found" description="Try a different search term or enroll students in this section." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Roll No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Attendance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Avg Marks</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">Coding XP</th>
                {canViewPerformance && <th className="px-4 py-3 w-20" />}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={student.avatar} name={student.name} size="sm" />
                      <p className="text-sm font-medium">{student.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground font-mono">
                    {student.rollNo ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">
                    {student.email}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {student.attendancePct != null ? (
                      <Badge
                        variant={student.attendancePct >= 75 ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {student.attendancePct.toFixed(0)}%
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm">
                    {student.averageMarks != null ? student.averageMarks.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-sm">
                    {student.codingXP ?? student.studentProfile?.leetcodeSolved ?? "—"}
                  </td>
                  {canViewPerformance && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setSelectedStudentId(student.id);
                          setPanelOpen(true);
                        }}
                      >
                        <BarChart3 className="size-3.5 mr-1" />
                        View
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StudentPerformancePanel
        studentId={selectedStudentId}
        sectionId={sectionId}
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelectedStudentId(null);
        }}
      />
    </div>
  );
}
