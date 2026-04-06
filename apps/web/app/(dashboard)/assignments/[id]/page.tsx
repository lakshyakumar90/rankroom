"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type ApiResponse } from "@repo/types";
import { formatDateTime } from "@/lib/utils";
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Upload,
  Star,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";

interface AssignmentSubmission {
  id: string;
  status: string;
  content?: string | null;
  grade?: number | null;
  feedback?: string | null;
  submittedAt?: string | null;
  gradedAt?: string | null;
  student?: { id: string; name: string; email: string; avatar?: string | null };
}

interface AssignmentDetail {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  maxMarks: number;
  status: string;
  subject: { id: string; name: string; code?: string | null };
  teacher: { id: string; name: string };
  section?: { id: string; name: string; code: string } | null;
  _count?: { submissions: number };
  mySubmission?: AssignmentSubmission | null;
}

const STATUS_COLORS: Record<string, string> = {
  GRADED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  SUBMITTED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  LATE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  PENDING: "bg-muted text-muted-foreground",
};

export default function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [submissionContent, setSubmissionContent] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);

  const isStudent = user?.role === "STUDENT";
  const isStaff = ["ADMIN", "SUPER_ADMIN", "TEACHER", "CLASS_COORDINATOR", "DEPARTMENT_HEAD"].includes(user?.role ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["assignment", id],
    queryFn: () => api.get<ApiResponse<AssignmentDetail>>(`/api/assignments/${id}`),
    enabled: !!id,
  });

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ["assignment-submissions", id],
    queryFn: () => api.get<ApiResponse<AssignmentSubmission[]>>(`/api/assignments/${id}/submissions`),
    enabled: !!id && isStaff,
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      if (submissionContent.trim()) {
        formData.append("content", submissionContent.trim());
      }
      if (submissionFile) {
        formData.append("file", submissionFile);
      }
      return api.post(`/api/assignments/${id}/submit`, formData);
    },
    onSuccess: () => {
      toast.success("Assignment submitted!");
      setSubmissionContent("");
      setSubmissionFile(null);
      queryClient.invalidateQueries({ queryKey: ["assignment", id] });
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", id] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (e: Error) => toast.error(e.message || "Submission failed"),
  });

  const assignment = data?.data;
  const submissions = submissionsData?.data ?? [];

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="size-8 text-muted-foreground" />
        <p className="text-muted-foreground">Assignment not found</p>
        <Link href="/assignments">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Back to Assignments
          </Button>
        </Link>
      </div>
    );
  }

  const dueDate = new Date(assignment.dueDate);
  const isPastDue = dueDate < new Date();
  const hasSubmission = !!assignment.mySubmission;
  const submissionStatus = assignment.mySubmission?.status;

  return (
    <div className="max-w-3xl space-y-6 p-6">
      {/* Back link */}
      <Link href="/assignments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-4" />
        Back to Assignments
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <h1 className="text-2xl font-bold tracking-tight flex-1">{assignment.title}</h1>
          {isPastDue && !hasSubmission && (
            <Badge variant="destructive">Closed</Badge>
          )}
          {hasSubmission && (
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[submissionStatus ?? "PENDING"] ?? STATUS_COLORS.PENDING}`}>
              {submissionStatus}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-3.5" />
            {assignment.subject.name}
            {assignment.subject.code && <span className="text-xs">({assignment.subject.code})</span>}
          </span>
          {assignment.section && (
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              {assignment.section.name}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Star className="size-3.5" />
            {assignment.maxMarks} marks
          </span>
        </div>
      </div>

      {/* Due date card */}
      <Card className={isPastDue ? "border-red-500/20 bg-red-500/5" : "border-primary/20 bg-primary/5"}>
        <CardContent className="flex items-center gap-4 p-4">
          <Calendar className={`size-5 shrink-0 ${isPastDue ? "text-red-500" : "text-primary"}`} />
          <div>
            <p className="text-xs text-muted-foreground">Due date</p>
            <p className="font-medium">{formatDateTime(assignment.dueDate)}</p>
          </div>
          {isPastDue ? (
            <div className="ml-auto flex items-center gap-1.5 text-sm text-red-500">
              <AlertCircle className="size-4" />
              Closed
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-1.5 text-sm text-emerald-500">
              <Clock className="size-4" />
              Open
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {assignment.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {assignment.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Student: submission area */}
      {isStudent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {hasSubmission ? "Your Submission" : "Submit Assignment"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasSubmission ? (
              <div className="space-y-3">
                {assignment.mySubmission?.content && (
                  <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                    {assignment.mySubmission.content}
                  </div>
                )}
                {assignment.mySubmission?.grade != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span>
                      Grade: <strong>{assignment.mySubmission.grade}</strong> / {assignment.maxMarks}
                    </span>
                  </div>
                )}
                {assignment.mySubmission?.feedback && (
                  <div className="rounded-md border border-border p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Feedback</p>
                    <p>{assignment.mySubmission.feedback}</p>
                  </div>
                )}
                {assignment.mySubmission?.submittedAt && (
                  <p className="text-xs text-muted-foreground">
                    Submitted {formatDateTime(assignment.mySubmission.submittedAt)}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  placeholder="Write your answer here..."
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                  rows={6}
                  disabled={isPastDue}
                />
                <div className="space-y-2">
                  <input
                    id="assignment-upload"
                    type="file"
                    className="hidden"
                    onChange={(event) => setSubmissionFile(event.target.files?.[0] ?? null)}
                    disabled={isPastDue}
                  />
                  <label
                    htmlFor="assignment-upload"
                    className={`flex cursor-pointer items-center justify-between rounded-md border border-input px-3 py-2 text-sm ${isPastDue ? "pointer-events-none opacity-60" : "hover:bg-muted/50"}`}
                  >
                    <span className="truncate text-muted-foreground">
                      {submissionFile?.name ?? "Attach a file if needed"}
                    </span>
                    <Upload className="size-4 shrink-0" />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {isPastDue ? "Submission deadline has passed" : "Add text, a file, or both before submitting"}
                  </p>
                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={(!submissionContent.trim() && !submissionFile) || isPastDue || submitMutation.isPending}
                    size="sm"
                  >
                    <Upload className="size-4 mr-2" />
                    {submitMutation.isPending ? "Submitting…" : "Submit"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Staff: submissions roster */}
      {isStaff && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Submissions ({submissions.length} / {assignment._count?.submissions ?? submissions.length})</span>
              <Badge variant="outline">{assignment.maxMarks} marks</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submissionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No submissions yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Submitted At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.student?.name ?? "—"}</TableCell>
                      <TableCell>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status] ?? STATUS_COLORS.PENDING}`}>
                          {sub.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {sub.grade != null ? (
                          <span>{sub.grade} / {assignment.maxMarks}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not graded</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.submittedAt ? formatDateTime(sub.submittedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
