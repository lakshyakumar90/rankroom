"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap } from "lucide-react";
import type { ApiResponse, Role } from "@repo/types";

interface SubjectRow {
  id: string;
  name: string;
  code: string;
  teacherAssignments: Array<{ teacher: { id: string; name: string } }>;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export function ManageTeachersDialog({ sectionId }: { sectionId: string }) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: subjectsData } = useQuery({
    queryKey: ["section", sectionId, "subjects"],
    queryFn: () => api.get<ApiResponse<SubjectRow[]>>(`/api/sections/${sectionId}/subjects`),
    enabled: open,
  });

  const { data: teachersData } = useQuery({
    queryKey: ["users", "teachers"],
    queryFn: () => api.get<ApiResponse<UserOption[]>>("/api/admin/users?role=TEACHER&limit=100"),
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: ({ subjectId, teacherId }: { subjectId: string; teacherId: string }) =>
      api.post(`/api/sections/${sectionId}/subject-assignments`, { subjectId, teacherId }),
    onSuccess: () => {
      toast.success("Teacher assigned");
      queryClient.invalidateQueries({ queryKey: ["section", sectionId, "subjects"] });
      queryClient.invalidateQueries({ queryKey: ["section", sectionId, "teachers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subjects = (subjectsData?.data ?? []).filter((s) => !(s as SubjectRow & { isArchived?: boolean }).isArchived);
  const teachers = teachersData?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GraduationCap className="mr-2 size-4" />
          Manage teachers
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign teachers to subjects</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-96 overflow-y-auto">
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subjects in this section.</p>
          ) : (
            subjects.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{subject.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{subject.code}</p>
                  {subject.teacherAssignments.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Current: {subject.teacherAssignments.map((a) => a.teacher.name).join(", ")}
                    </p>
                  )}
                </div>
                <Select
                  value={selection[subject.id] ?? ""}
                  onValueChange={(v) => setSelection((s) => ({ ...s, [subject.id]: v }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    assignMutation.mutate({ subjectId: subject.id, teacherId: selection[subject.id] ?? "" })
                  }
                  disabled={!selection[subject.id] || assignMutation.isPending}
                >
                  Assign
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
