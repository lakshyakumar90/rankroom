"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, UserCheck, Archive } from "lucide-react";
import { toast } from "sonner";
import type { ApiResponse } from "@repo/types";
import { EmptyState } from "@/components/common/page-shell";
import { EditSubjectDialog } from "@/components/sections/EditSubjectDialog";
import { useState } from "react";
import { useCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

interface SubjectRow {
  id: string;
  name: string;
  code: string;
  isArchived: boolean;
  teacherAssignments: Array<{
    teacher: { id: string; name: string; email: string };
  }>;
  resultConfig?: {
    maxMidTerm: number;
    maxEndTerm: number;
    maxAssignment: number;
    maxTC: number;
  } | null;
  _count: { grades: number; assignments: number };
}

export function SectionSubjectsTab({ sectionId }: { sectionId: string }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);

  const isTeacher = user?.role === "TEACHER";
  // Teachers only see subjects assigned to them; others see all
  const subjectsUrl = isTeacher
    ? `/api/sections/${sectionId}/subjects?teacherId=me`
    : `/api/sections/${sectionId}/subjects`;

  const { data, isLoading } = useQuery({
    queryKey: ["section", sectionId, "subjects", isTeacher ? "teacher" : "all"],
    queryFn: () => api.get<ApiResponse<SubjectRow[]>>(subjectsUrl),
    enabled: !!sectionId,
  });

  const archiveMutation = useMutation({
    mutationFn: (subjectId: string) => api.post(`/api/subjects/${subjectId}/archive`, {}),
    onSuccess: () => {
      toast.success("Subject archived");
      queryClient.invalidateQueries({ queryKey: ["section", sectionId, "subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subjects = (data?.data ?? []).filter((s) => !s.isArchived);
  const canEdit = user && hasPermission(user.role, "subjects:update");
  const canArchive = user && hasPermission(user.role, "subjects:archive");

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  if (subjects.length === 0) {
    return <EmptyState title="No subjects" description="Add subjects to this section to manage assignments and grades." />;
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Teachers</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Max Marks</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Activity</th>
              {(canEdit || canArchive) && <th className="sr-only">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => {
              const totalMax = subject.resultConfig
                ? subject.resultConfig.maxMidTerm +
                  subject.resultConfig.maxEndTerm +
                  subject.resultConfig.maxAssignment +
                  subject.resultConfig.maxTC
                : null;
              return (
                <tr key={subject.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{subject.name}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="outline" className="font-mono text-xs">{subject.code}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {subject.teacherAssignments.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      ) : (
                        subject.teacherAssignments.map((a) => (
                          <Badge key={a.teacher.id} variant="secondary" className="text-xs">{a.teacher.name}</Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">
                    {totalMax != null ? `${totalMax} pts` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {subject._count.grades} grades · {subject._count.assignments} assignments
                  </td>
                  {(canEdit || canArchive) && (
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => setEditingSubject(subject)}>
                              <Pencil className="mr-2 size-4" /> Edit subject
                            </DropdownMenuItem>
                          )}
                          {canEdit && (
                            <DropdownMenuItem onClick={() => setEditingSubject(subject)}>
                              <UserCheck className="mr-2 size-4" /> Change teacher
                            </DropdownMenuItem>
                          )}
                          {canArchive && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => archiveMutation.mutate(subject.id)}
                            >
                              <Archive className="mr-2 size-4" /> Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingSubject && (
        <EditSubjectDialog
          subject={editingSubject}
          sectionId={sectionId}
          open
          onClose={() => setEditingSubject(null)}
        />
      )}
    </>
  );
}
