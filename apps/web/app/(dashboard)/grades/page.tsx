"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth";
import { type ApiResponse, ExamType, Role, type Grade } from "@repo/types";
import { GraduationCap, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface BatchOption {
  id: string;
  name: string;
  year: number;
  semester: number;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface Enrollment {
  studentId: string;
  student: {
    id: string;
    name: string;
    email?: string;
  };
}

interface GradeWithSubject extends Grade {
  subject: {
    name: string;
    code: string;
  };
}

export default function GradesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isStaff =
    user?.role === Role.ADMIN ||
    user?.role === Role.SUPER_ADMIN ||
    user?.role === Role.DEPARTMENT_HEAD ||
    user?.role === Role.CLASS_COORDINATOR ||
    user?.role === Role.TEACHER;
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [examType, setExamType] = useState<ExamType>(ExamType.INTERNAL);
  const [semester, setSemester] = useState(1);
  const [maxMarks, setMaxMarks] = useState(100);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["grades", "me"],
    queryFn: () => api.get<ApiResponse<GradeWithSubject[]>>(`/api/grades/student/${user!.id}`),
    enabled: !!user && !isStaff,
  });

  const { data: classesData } = useQuery({
    queryKey: ["teacher-classes", "grades"],
    queryFn: () => api.get<ApiResponse<BatchOption[]>>("/api/users/me/classes"),
    enabled: !!user && isStaff,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects", selectedBatch, "grades"],
    queryFn: () => api.get<ApiResponse<SubjectOption[]>>(`/api/subjects/batch/${selectedBatch}`),
    enabled: !!user && isStaff && !!selectedBatch,
  });

  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["grade-roster", selectedBatch],
    queryFn: () => api.get<ApiResponse<Enrollment[]>>(`/api/users/batch/${selectedBatch}/students`),
    enabled: !!user && isStaff && !!selectedBatch,
  });

  const { data: existingGradesData, isLoading: gradesLoading } = useQuery({
    queryKey: ["class-grades", selectedBatch, selectedSubject, examType, semester],
    queryFn: () =>
      api.get<ApiResponse<(Grade & { student: { id: string; name: string } })[]>>(
        `/api/grades/class/${selectedBatch}?subjectId=${selectedSubject}&examType=${examType}&semester=${semester}`
      ),
    enabled: !!user && isStaff && !!selectedBatch && !!selectedSubject,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = roster
        .map((entry) => ({
          studentId: entry.student.id,
          marks: marks[entry.student.id],
          remarks: remarks[entry.student.id]?.trim() || undefined,
        }))
        .filter((entry) => entry.marks !== undefined && entry.marks !== "");

      if (rows.length === 0) {
        throw new Error("Enter at least one mark before saving");
      }

      const invalid = rows.find((entry) => Number.isNaN(Number(entry.marks)) || Number(entry.marks) < 0 || Number(entry.marks) > maxMarks);
      if (invalid) {
        throw new Error(`Marks must be between 0 and ${maxMarks}`);
      }

      return api.post<ApiResponse<Grade[]>>("/api/grades/bulk", {
        subjectId: selectedSubject,
        examType,
        maxMarks,
        semester,
        grades: rows.map((entry) => ({
          studentId: entry.studentId,
          marks: Number(entry.marks),
          remarks: entry.remarks,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Grades saved successfully");
      queryClient.invalidateQueries({ queryKey: ["class-grades", selectedBatch, selectedSubject, examType, semester] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save grades"),
  });

  const grades = data?.data ?? [];
  const classes = classesData?.data ?? [];
  const subjects = subjectsData?.data ?? [];
  const roster = enrollmentsData?.data ?? [];
  const existingGrades = existingGradesData?.data ?? [];

  useEffect(() => {
    const currentClass = classes.find((entry) => entry.id === selectedBatch);
    if (currentClass) {
      setSemester(currentClass.semester);
    }
  }, [classes, selectedBatch]);

  useEffect(() => {
    const byStudentId = new Map(existingGrades.map((entry) => [entry.studentId, entry]));
    const nextMarks: Record<string, string> = {};
    const nextRemarks: Record<string, string> = {};

    roster.forEach((entry) => {
      const existing = byStudentId.get(entry.student.id);
      if (existing) {
        nextMarks[entry.student.id] = String(existing.marks);
        nextRemarks[entry.student.id] = existing.remarks ?? "";
      }
    });

    if (existingGrades.length > 0 || roster.length > 0) {
      setMarks(nextMarks);
      setRemarks(nextRemarks);
      const existingMax = existingGrades[0]?.maxMarks;
      if (existingMax) setMaxMarks(existingMax);
    }
  }, [existingGrades, roster]);

  // Group by subject
  const gradesBySubject = grades.reduce<Record<string, { name: string; code: string; grades: typeof grades }>>((acc, g) => {
    const key = g.subjectId;
    if (!acc[key]) acc[key] = { name: g.subject.name, code: g.subject.code, grades: [] };
    acc[key]!.grades.push(g);
    return acc;
  }, {});

  const getExamBadge = (type: string) => {
    const map: Record<string, string> = { MID: "bg-blue-500/15 text-blue-500", FINAL: "bg-purple-500/15 text-purple-500", INTERNAL: "bg-amber-500/15 text-amber-500", ASSIGNMENT: "bg-emerald-500/15 text-emerald-500" };
    return map[type] ?? "";
  };

  const gradeSummary = useMemo(() => {
    const entered = roster.filter((entry) => marks[entry.student.id] !== undefined && marks[entry.student.id] !== "").length;
    const existing = new Set(existingGrades.map((entry) => entry.studentId)).size;
    return { entered, existing };
  }, [existingGrades, marks, roster]);

  if (isStaff) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grades</h1>
          <p className="text-muted-foreground">Manage grades in bulk for your classes and subjects</p>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-5 md:grid-cols-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Class</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedBatch}
                onChange={(e) => {
                  setSelectedBatch(e.target.value);
                  setSelectedSubject("");
                  setMarks({});
                  setRemarks({});
                }}
              >
                <option value="">Select class</option>
                {classes.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subject</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={!selectedBatch}
              >
                <option value="">Select subject</option>
                {subjects.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Exam Type</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
              >
                {Object.values(ExamType).map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Semester</label>
              <Input type="number" min={1} max={10} value={semester} onChange={(e) => setSemester(Number(e.target.value) || 1)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Max Marks</label>
              <Input type="number" min={1} value={maxMarks} onChange={(e) => setMaxMarks(Number(e.target.value) || 1)} />
            </div>
          </CardContent>
        </Card>

        {selectedBatch && selectedSubject && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Bulk Grade Entry</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {gradeSummary.entered} entered • {gradeSummary.existing} existing records prefilled
                  </p>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || roster.length === 0}>
                  {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Grades
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {enrollmentsLoading || gradesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="grid gap-3 md:grid-cols-[1.5fr,120px,1fr]">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : roster.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No students are enrolled in this class yet.</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid-cols-[1.5fr,120px,1fr]">
                    <span>Student</span>
                    <span>Marks</span>
                    <span>Remarks</span>
                  </div>

                  {roster.map((entry) => {
                    const currentMarks = marks[entry.student.id] ?? "";
                    const hasExistingGrade = existingGrades.some((grade) => grade.studentId === entry.student.id);
                    const numericMarks = currentMarks === "" ? undefined : Number(currentMarks);
                    const invalidMarks = numericMarks !== undefined && (Number.isNaN(numericMarks) || numericMarks < 0 || numericMarks > maxMarks);

                    return (
                      <div key={entry.student.id} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1.5fr,120px,1fr]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{entry.student.name}</p>
                            {hasExistingGrade && <Badge variant="outline">Existing</Badge>}
                          </div>
                          {entry.student.email && <p className="truncate text-xs text-muted-foreground">{entry.student.email}</p>}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={maxMarks}
                          value={currentMarks}
                          onChange={(e) => setMarks((current) => ({ ...current, [entry.student.id]: e.target.value }))}
                          className={invalidMarks ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        <Input
                          value={remarks[entry.student.id] ?? ""}
                          onChange={(e) => setRemarks((current) => ({ ...current, [entry.student.id]: e.target.value }))}
                          placeholder="Optional feedback"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grades</h1>
        <p className="text-muted-foreground">Your academic performance across all subjects</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))
        ) : Object.keys(gradesBySubject).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No grades available yet</p>
          </div>
        ) : (
          Object.entries(gradesBySubject).map(([subjectId, { name, code, grades: subGrades }]) => {
            const avg = subGrades.reduce((sum, g) => sum + (g.marks / g.maxMarks) * 100, 0) / subGrades.length;
            return (
              <Card key={subjectId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{code}</span>
                      <Badge variant="outline">{avg.toFixed(1)}% avg</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {subGrades.map((g) => (
                      <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${getExamBadge(g.examType)}`}>{g.examType}</span>
                          <span className="text-sm text-muted-foreground">Semester {g.semester}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{g.marks} / {g.maxMarks}</p>
                          <p className="text-xs text-muted-foreground">{((g.marks / g.maxMarks) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
