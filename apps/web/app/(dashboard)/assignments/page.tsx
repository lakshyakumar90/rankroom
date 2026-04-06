"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import { Role, type ApiResponse, type Assignment, type AssignmentSubmission } from "@repo/types";
import { formatDateTime } from "@/lib/utils";
import { BookOpen, Clock, Upload, Plus, Users, ChevronRight, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type AssignmentListItem = Assignment & {
  mySubmission?: AssignmentSubmission | null;
  subject: { id: string; name: string; code?: string };
  teacher: { name: string };
  _count: { submissions: number };
};

function StatusBadge({ assignment }: { assignment: AssignmentListItem }) {
  const deadlinePassed = new Date(assignment.dueDate) < new Date();
  const hasSubmission = !!assignment.mySubmission;

  if (hasSubmission) {
    const status = assignment.mySubmission?.status;
    const color =
      status === "GRADED"
        ? "bg-emerald-500/10 text-emerald-600"
        : status === "SUBMITTED"
          ? "bg-blue-500/10 text-blue-600"
          : status === "LATE"
            ? "bg-amber-500/10 text-amber-600"
            : "bg-muted";
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
  }
  if (deadlinePassed) {
    return <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600">CLOSED</span>;
  }
  return <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">OPEN</span>;
}

// ─── Create Assignment Dialog ─────────────────────────────────────────────────
function CreateAssignmentDialog({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [targetStudentIds, setTargetStudentIds] = useState<string[]>([]);

  const subjects = useMemo(
    () =>
      Array.from(
        new Map(
          (user?.teachingAssignments ?? []).map((entry) => [
            entry.subjectId,
            { id: entry.subjectId, label: `${entry.subject?.name ?? entry.subjectId} · ${entry.section?.name ?? entry.sectionId}` },
          ])
        ).values()
      ),
    [user?.teachingAssignments]
  );

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
      setSelectedSubjectId("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
      onCreated?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const studentOptions = studentsData?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-xl">
          <Plus className="size-4" />
          Create Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <div className="mb-4">
          <DialogTitle>New Assignment</DialogTitle>
          <p className="text-sm text-muted-foreground">Create an assignment for your class. Students will be notified.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" />
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.label}</option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Assignment description"
            className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Max Score</label>
            <Input type="number" min="1" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
          </div>

          {selectedSubjectId && studentOptions.length > 0 && (
            <div className="space-y-2 md:col-span-2">
              <p className="text-sm font-medium">Target students (optional — leave empty for all)</p>
              <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
                {studentOptions.map((entry) => (
                  <label key={entry.student.id} className="flex cursor-pointer items-center gap-2 text-sm">
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
          )}

          <div className="md:col-span-2">
            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!title || !description || !dueDate || !selectedSubjectId || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create Assignment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Teacher Assignment Row ──────────────────────────────────────────────────
function TeacherAssignmentRow({ assignment }: { assignment: AssignmentListItem }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div>
          <p>{assignment.title}</p>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Users className="size-3" />
            {assignment._count?.submissions ?? 0} submitted
          </div>
        </div>
      </TableCell>
      <TableCell>{formatDateTime(assignment.dueDate)}</TableCell>
      <TableCell>
        <span className="font-semibold">{assignment.maxScore}</span>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/assignments/${assignment.id}`}>
            View Details
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─── Student Assignment Row ───────────────────────────────────────────────────
function StudentAssignmentRow({
  assignment,
  file,
  onFileChange,
  onSubmit,
  isSubmitting,
}: {
  assignment: AssignmentListItem;
  file: File | null | undefined;
  onFileChange: (id: string, file: File | null) => void;
  onSubmit: (id: string) => void;
  isSubmitting: boolean;
}) {
  const isPast = new Date(assignment.dueDate) < new Date();
  const hasSubmission = !!assignment.mySubmission;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{assignment.title}</span>
          <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{assignment.description}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {formatDateTime(assignment.dueDate)}
        </div>
      </TableCell>
      <TableCell><StatusBadge assignment={assignment} /></TableCell>
      <TableCell>
        {hasSubmission ? (
          <span className="font-semibold">{assignment.mySubmission?.score ?? "—"} <span className="text-xs font-normal text-muted-foreground">/ {assignment.maxScore}</span></span>
        ) : (
          <span className="text-muted-foreground text-sm">— / {assignment.maxScore}</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/assignments/${assignment.id}`}>
              <ChevronRight className="size-3.5 mr-1" />
              Details
            </Link>
          </Button>
          {hasSubmission ? (
            assignment.mySubmission!.fileUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={assignment.mySubmission!.fileUrl} target="_blank" rel="noreferrer">
                  View Submission
                </a>
              </Button>
            ) : null
          ) : isPast ? (
            <span className="text-xs text-muted-foreground">Closed</span>
          ) : (
            <>
              <input
                id={`assignment-file-${assignment.id}`}
                type="file"
                onChange={(e) => onFileChange(assignment.id, e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <label
                htmlFor={`assignment-file-${assignment.id}`}
                className="inline-flex max-w-[190px] cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted/60"
              >
                <Upload className="size-3.5 shrink-0" />
                <span className="truncate">{file?.name ?? "Choose file"}</span>
              </label>
              <Button onClick={() => onSubmit(assignment.id)} disabled={isSubmitting || !file} size="sm" className="gap-2">
                <Upload className="size-3.5" />
                Submit
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AssignmentsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [files, setFiles] = useState<Record<string, File | null>>({});

  const canCreate = [Role.TEACHER, Role.CLASS_COORDINATOR, Role.DEPARTMENT_HEAD, Role.ADMIN, Role.SUPER_ADMIN].includes(
    user?.role ?? Role.STUDENT
  );

  const { data, isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => api.get<ApiResponse<AssignmentListItem[]>>("/api/assignments/mine"),
    enabled: !!user,
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
  const isStudent = user?.role === Role.STUDENT;

  const activeAssignments = assignments.filter((a) => new Date(a.dueDate) >= new Date());
  const pastAssignments = assignments.filter((a) => new Date(a.dueDate) < new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">
            {isStudent
              ? "Submit your work before the deadline."
              : "Manage and review subject-based assignments."}
          </p>
        </div>
        {canCreate && <CreateAssignmentDialog />}
      </div>

      {/* Teacher: summary stats */}
      {!isStudent && assignments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <FileText className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{assignments.length}</p>
                <p className="text-xs text-muted-foreground">Total assignments</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-green-500/10 text-green-500">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeAssignments.length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{assignments.reduce((sum, a) => sum + (a._count?.submissions ?? 0), 0)}</p>
                <p className="text-xs text-muted-foreground">Total submissions</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assignment list */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-3 size-12 opacity-20" />
          <p>No assignments yet</p>
          {canCreate && (
            <p className="mt-1 text-sm">Create your first assignment using the button above.</p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(
            assignments.reduce((acc, assignment) => {
              const key = assignment.subjectId;
              if (!acc[key]) acc[key] = { subject: assignment.subject, assignments: [] };
              acc[key].assignments.push(assignment);
              return acc;
            }, {} as Record<string, { subject: AssignmentListItem['subject'], assignments: AssignmentListItem[] }>)
          ).map(([subjectId, group]) => (
            <Card key={subjectId}>
              <CardHeader className="pb-3 border-b border-border bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="size-4" />
                  {group.subject.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-1/3">Assignment</TableHead>
                        <TableHead>Deadline</TableHead>
                        {isStudent && <TableHead>Status</TableHead>}
                        <TableHead>{isStudent ? "Score" : "Max Score"}</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.assignments.map((assignment) =>
                        isStudent ? (
                          <StudentAssignmentRow
                            key={assignment.id}
                            assignment={assignment}
                            file={files[assignment.id]}
                            onFileChange={(id, file) => setFiles((curr) => ({ ...curr, [id]: file }))}
                            onSubmit={(id) => submitMutation.mutate(id)}
                            isSubmitting={submitMutation.isPending}
                          />
                        ) : (
                          <TeacherAssignmentRow key={assignment.id} assignment={assignment} />
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
