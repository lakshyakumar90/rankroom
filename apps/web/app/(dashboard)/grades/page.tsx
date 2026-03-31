"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth";
import { type ApiResponse, ExamType, Role, type Grade } from "@repo/types";
import { GraduationCap, Loader2, Save, TrendingUp, BookOpen, Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────
const EXAM_MAX_MARKS: Record<ExamType, number> = {
  [ExamType.MID]: 25,
  [ExamType.FINAL]: 50,
  [ExamType.ASSIGNMENT]: 15,
  [ExamType.INTERNAL]: 10,
};

const EXAM_LABELS: Record<ExamType, string> = {
  [ExamType.MID]: "Mid-Term (max 25)",
  [ExamType.FINAL]: "End-Term (max 50)",
  [ExamType.ASSIGNMENT]: "Assignment (max 15)",
  [ExamType.INTERNAL]: "Teacher's Choice (max 10)",
};

const EXAM_BADGE_COLORS: Record<string, string> = {
  MID: "bg-blue-500/15 text-blue-600",
  FINAL: "bg-purple-500/15 text-purple-600",
  INTERNAL: "bg-amber-500/15 text-amber-600",
  ASSIGNMENT: "bg-emerald-500/15 text-emerald-600",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface BatchOption { id: string; name: string; year: number; semester: number }
interface SubjectOption { id: string; name: string; code: string }
interface Enrollment { studentId: string; student: { id: string; name: string; email?: string } }
interface GradeWithSubject extends Grade { subject: { name: string; code: string } }
interface CgpaData {
  cgpa: number;
  totalSubjects: number;
  subjectBreakdown: Array<{
    subjectId: string; subjectName: string; subjectCode: string;
    totalObtained: number; totalMax: number; percentage: number; cgpaPoints: number;
  }>;
}

// ─── CGPA Ring ────────────────────────────────────────────────────────────────
function CgpaRing({ cgpa }: { cgpa: number }) {
  const pct = (cgpa / 10) * 100;
  const color = cgpa >= 8 ? "text-emerald-500" : cgpa >= 6 ? "text-amber-500" : "text-red-500";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-5xl font-bold tabular-nums ${color}`}>{cgpa.toFixed(2)}</div>
      <div className="text-sm text-muted-foreground">CGPA / 10</div>
      <div className="mt-1 h-2 w-32 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${cgpa >= 8 ? "bg-emerald-500" : cgpa >= 6 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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
  const [examType, setExamType] = useState<ExamType>(ExamType.MID);
  const [semester, setSemester] = useState(1);
  const [maxMarks, setMaxMarks] = useState(EXAM_MAX_MARKS[ExamType.MID]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  // Auto-update maxMarks when examType changes
  useEffect(() => {
    setMaxMarks(EXAM_MAX_MARKS[examType]);
  }, [examType]);

  // ── Student queries ─────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["grades", "me"],
    queryFn: () => api.get<ApiResponse<GradeWithSubject[]>>(`/api/grades/student/${user!.id}`),
    enabled: !!user && !isStaff,
  });

  const { data: cgpaData, isLoading: cgpaLoading } = useQuery({
    queryKey: ["cgpa", user?.id],
    queryFn: () => api.get<ApiResponse<CgpaData>>(`/api/grades/student/${user!.id}/cgpa`),
    enabled: !!user && !isStaff,
  });

  // ── Staff queries ───────────────────────────────────────────────────────────
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

      if (rows.length === 0) throw new Error("Enter at least one mark before saving");

      const invalid = rows.find(
        (entry) => Number.isNaN(Number(entry.marks)) || Number(entry.marks) < 0 || Number(entry.marks) > maxMarks
      );
      if (invalid) throw new Error(`Marks must be between 0 and ${maxMarks}`);

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
  const cgpa = cgpaData?.data;

  useEffect(() => {
    const currentClass = classes.find((entry) => entry.id === selectedBatch);
    if (currentClass) setSemester(currentClass.semester);
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

  const gradesBySubject = grades.reduce<Record<string, { name: string; code: string; grades: typeof grades }>>((acc, g) => {
    const key = g.subjectId;
    if (!acc[key]) acc[key] = { name: g.subject.name, code: g.subject.code, grades: [] };
    acc[key]!.grades.push(g);
    return acc;
  }, {});

  const gradeSummary = useMemo(() => {
    const entered = roster.filter((entry) => marks[entry.student.id] !== undefined && marks[entry.student.id] !== "").length;
    const existing = new Set(existingGrades.map((entry) => entry.studentId)).size;
    return { entered, existing };
  }, [existingGrades, marks, roster]);

  // ─── Teacher / Staff View ────────────────────────────────────────────────────
  if (isStaff) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grades</h1>
          <p className="text-muted-foreground">Enter marks for your classes. Max marks are preset per exam type.</p>
        </div>

        {/* Info banner about marking scheme */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Marking scheme:</strong>{" "}
              Mid-Term = 25 marks · End-Term = 50 marks · Assignments = 15 marks · Teacher&apos;s Choice = 10 marks
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-3 p-5 md:grid-cols-5">
            {/* Class */}
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
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </div>

            {/* Subject */}
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
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.code})</option>
                ))}
              </select>
            </div>

            {/* Exam Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Exam Type</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
              >
                {Object.values(ExamType).map((entry) => (
                  <option key={entry} value={entry}>{EXAM_LABELS[entry]}</option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Semester</label>
              <Input type="number" min={1} max={10} value={semester} onChange={(e) => setSemester(Number(e.target.value) || 1)} />
            </div>

            {/* Max Marks (auto-set but overridable) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Max Marks
                <span className="ml-1 text-xs text-muted-foreground">(auto)</span>
              </label>
              <Input
                type="number"
                min={1}
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value) || 1)}
                className="border-primary/40"
              />
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
                    {" "}• Max {maxMarks} marks
                  </p>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || roster.length === 0}>
                  {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Grades
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {enrollmentsLoading || gradesLoading ? (
                <div className="space-y-3 p-6">
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[40%]">Student</TableHead>
                        <TableHead className="w-[30%]">Marks / {maxMarks}</TableHead>
                        <TableHead className="w-[30%]">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roster.map((entry) => {
                        const currentMarks = marks[entry.student.id] ?? "";
                        const hasExistingGrade = existingGrades.some((grade) => grade.studentId === entry.student.id);
                        const numericMarks = currentMarks === "" ? undefined : Number(currentMarks);
                        const invalidMarks =
                          numericMarks !== undefined &&
                          (Number.isNaN(numericMarks) || numericMarks < 0 || numericMarks > maxMarks);

                        return (
                          <TableRow key={entry.student.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{entry.student.name}</span>
                                  {hasExistingGrade && <Badge variant="secondary" className="text-[10px]">Existing</Badge>}
                                </div>
                                {entry.student.email && (
                                  <span className="text-xs text-muted-foreground">{entry.student.email}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={maxMarks}
                                value={currentMarks}
                                onChange={(e) => setMarks((current) => ({ ...current, [entry.student.id]: e.target.value }))}
                                className={cn("h-8 max-w-[120px]", invalidMarks && "border-red-500 focus-visible:ring-red-500")}
                                placeholder={`0–${maxMarks}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 max-w-[200px]"
                                value={remarks[entry.student.id] ?? ""}
                                onChange={(e) => setRemarks((current) => ({ ...current, [entry.student.id]: e.target.value }))}
                                placeholder="Optional feedback"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ─── Student View ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grades</h1>
        <p className="text-muted-foreground">Your academic performance across all subjects</p>
      </div>

      {/* CGPA Banner */}
      {cgpaLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <Skeleton className="h-24 w-48" />
          </CardContent>
        </Card>
      ) : cgpa ? (
        <Card className="overflow-hidden">
          <CardContent className="grid gap-6 p-6 sm:grid-cols-2">
            <div className="flex flex-col items-center justify-center gap-2">
              <CgpaRing cgpa={cgpa.cgpa} />
              <p className="text-xs text-muted-foreground">Based on {cgpa.totalSubjects} subject{cgpa.totalSubjects !== 1 ? "s" : ""}</p>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Subject Breakdown</h3>
              {cgpa.subjectBreakdown.map((sub) => (
                <div key={sub.subjectId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{sub.subjectName} <span className="text-muted-foreground/60">({sub.subjectCode})</span></span>
                    <span className="font-medium">{sub.cgpaPoints.toFixed(1)} / 10</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full ${sub.cgpaPoints >= 8 ? "bg-emerald-500" : sub.cgpaPoints >= 6 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${(sub.cgpaPoints / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Detailed grades by subject */}
      <Card>
        <CardHeader className="pb-3 border-b border-border bg-muted/20">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="size-4" />
            Subject Grades
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="min-w-[200px]">Subject</TableHead>
                  <TableHead className="text-center">Mid-Term (25)</TableHead>
                  <TableHead className="text-center">End-Term (50)</TableHead>
                  <TableHead className="text-center">Assignment (15)</TableHead>
                  <TableHead className="text-center">TC (10)</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : Object.keys(gradesBySubject).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                      <GraduationCap className="mx-auto mb-3 size-10 opacity-20" />
                      <p>No grades available yet</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(gradesBySubject).map(([subjectId, { name, code, grades: subGrades }]) => {
                    const mid = subGrades.find(g => g.examType === "MID");
                    const final = subGrades.find(g => g.examType === "FINAL");
                    const assignment = subGrades.find(g => g.examType === "ASSIGNMENT");
                    const internal = subGrades.find(g => g.examType === "INTERNAL");
                    
                    const totalObtained = subGrades.reduce((sum, g) => sum + g.marks, 0);
                    const totalMax = subGrades.reduce((sum, g) => sum + g.maxMarks, 0);
                    const pct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

                    const renderCell = (g?: typeof subGrades[0]) => {
                      if (!g) return <span className="text-muted-foreground/30">—</span>;
                      return (
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-semibold">{g.marks}</span>
                        </div>
                      );
                    };

                    return (
                      <TableRow key={subjectId}>
                        <TableCell>
                          <p className="font-medium text-sm">{name}</p>
                          <p className="text-xs text-muted-foreground">{code}</p>
                        </TableCell>
                        <TableCell className="text-center">{renderCell(mid)}</TableCell>
                        <TableCell className="text-center">{renderCell(final)}</TableCell>
                        <TableCell className="text-center">{renderCell(assignment)}</TableCell>
                        <TableCell className="text-center">{renderCell(internal)}</TableCell>
                        <TableCell className="text-right">
                          <p className="font-semibold">{totalObtained} <span className="text-xs font-normal text-muted-foreground">/ {totalMax}</span></p>
                          {totalMax > 0 && <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
