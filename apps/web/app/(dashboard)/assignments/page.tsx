"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth";
import { Role, type ApiResponse, type Assignment, type AssignmentSubmission } from "@repo/types";
import { formatDateTime } from "@/lib/utils";
import { BookOpen, Clock, Upload } from "lucide-react";
import { toast } from "sonner";

type AssignmentListItem = Assignment & {
  mySubmission?: AssignmentSubmission | null;
  subject: { id: string; name: string; code?: string };
  teacher: { name: string };
  _count: { submissions: number };
};

export default function AssignmentsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [targetStudentIds, setTargetStudentIds] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, File | null>>({});

  const subjects = useMemo(
    () =>
      Array.from(
        new Map(
          (user?.teachingAssignments ?? []).map((entry) => [
            entry.subjectId,
            { id: entry.subjectId, label: `${entry.subject.name} · ${entry.section.name}` },
          ])
        ).values()
      ),
    [user?.teachingAssignments]
  );

  const canCreate = [Role.TEACHER, Role.CLASS_COORDINATOR, Role.DEPARTMENT_HEAD, Role.ADMIN, Role.SUPER_ADMIN].includes(
    user?.role ?? Role.STUDENT
  );

  const { data, isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => api.get<ApiResponse<AssignmentListItem[]>>("/api/assignments/mine"),
    enabled: !!user,
  });

  const { data: studentsData } = useQuery({
    queryKey: ["assignments-create", "students", selectedSubjectId],
    queryFn: async () => {
      const sectionId =
        (user?.teachingAssignments ?? []).find((entry) => entry.subjectId === selectedSubjectId)?.sectionId ?? "";
      return api.get<ApiResponse<Array<{ student: { id: string; name: string } }>>>(
        `/api/users/section/${sectionId}/students`
      );
    },
    enabled: !!selectedSubjectId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/api/assignments", {
        title,
        description,
        subjectId: selectedSubjectId,
        dueDate: new Date(dueDate).toISOString(),
        maxScore: Number(maxScore),
        targetStudentIds,
      }),
    onSuccess: () => {
      toast.success("Assignment created");
      setTitle("");
      setDescription("");
      setDueDate("");
      setMaxScore("100");
      setTargetStudentIds([]);
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const file = files[assignmentId];
      const formData = new FormData();
      if (file) formData.append("file", file);
      return api.post(`/api/assignments/${assignmentId}/submit`, formData);
    },
    onSuccess: () => {
      toast.success("Assignment submitted");
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignments = data?.data ?? [];
  const studentOptions = studentsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">
            {user?.role === Role.STUDENT ? "Submit work before the deadline." : "Create and review subject-based assignments."}
          </p>
        </div>
      </div>

      {canCreate && subjects.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Assignment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Assignment title" />
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="h-9 border border-input bg-background px-3 text-sm"
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </select>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Assignment description"
              className="min-h-28 border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            />
            <Input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <Input type="number" min="1" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} />
            {selectedSubjectId ? (
              <div className="space-y-2 md:col-span-2">
                <p className="text-sm font-medium">Selected students (optional)</p>
                <div className="grid max-h-44 gap-2 overflow-y-auto border border-border p-3 sm:grid-cols-2">
                  {studentOptions.map((entry) => (
                    <label key={entry.student.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={targetStudentIds.includes(entry.student.id)}
                        onChange={() =>
                          setTargetStudentIds((current) =>
                            current.includes(entry.student.id)
                              ? current.filter((id) => id !== entry.student.id)
                              : [...current, entry.student.id]
                          )
                        }
                      />
                      <span>{entry.student.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="md:col-span-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!title || !description || !dueDate || !selectedSubjectId || createMutation.isPending}
              >
                Create assignment
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="mb-2 h-5 w-48" />
                <Skeleton className="mb-3 h-4 w-full" />
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : assignments.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-20" />
            <p>No assignments available</p>
          </div>
        ) : (
          assignments.map((assignment) => {
            const deadlinePassed = new Date(assignment.dueDate) < new Date();
            const hasSubmission = !!assignment.mySubmission;
            return (
              <Card key={assignment.id} className={deadlinePassed && !hasSubmission ? "border-destructive/40" : ""}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{assignment.title}</h3>
                        <Badge variant="outline">{assignment.subject.name}</Badge>
                        {hasSubmission ? (
                          <Badge variant="secondary">{assignment.mySubmission?.status}</Badge>
                        ) : deadlinePassed ? (
                          <Badge variant="destructive">Closed</Badge>
                        ) : (
                          <Badge variant="outline">Open</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{assignment.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due {formatDateTime(assignment.dueDate)}
                        </span>
                        <span>Max {assignment.maxScore} pts</span>
                        <span>by {assignment.teacher.name}</span>
                      </div>
                    </div>
                    {user?.role !== Role.STUDENT ? (
                      <div className="text-right text-sm">
                        <p className="font-medium">{assignment._count.submissions}</p>
                        <p className="text-xs text-muted-foreground">submissions</p>
                      </div>
                    ) : null}
                  </div>

                  {user?.role === Role.STUDENT && !deadlinePassed && !hasSubmission ? (
                    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                      <Input
                        type="file"
                        className="max-w-sm"
                        onChange={(event) =>
                          setFiles((current) => ({ ...current, [assignment.id]: event.target.files?.[0] ?? null }))
                        }
                      />
                      <Button onClick={() => submitMutation.mutate(assignment.id)} disabled={submitMutation.isPending}>
                        <Upload className="mr-2 h-4 w-4" />
                        Submit
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
