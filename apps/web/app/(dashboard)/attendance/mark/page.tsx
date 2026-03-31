"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse } from "@repo/types";
import { CheckCircle2, XCircle, Clock, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

interface Batch { id: string; name: string; year: number; semester: number; department: { name: string } }
interface Enrollment { studentId: string; student: { id: string; name: string; avatar?: string | null } }

type AttendanceStatusType = "PRESENT" | "ABSENT" | "LATE";

export default function MarkAttendancePage() {
  const { user } = useAuthStore();
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<Record<string, AttendanceStatusType>>({});

  const { data: classesData } = useQuery({
    queryKey: ["teacher-classes"],
    queryFn: () => api.get<ApiResponse<Batch[]>>("/api/users/me/classes"),
    enabled: !!user,
  });

  const { data: enrollmentsData, isLoading: loadingEnrollments } = useQuery({
    queryKey: ["enrollments", selectedBatch],
    queryFn: () => api.get<ApiResponse<Enrollment[]>>(`/api/users/batch/${selectedBatch}/students`),
    enabled: !!selectedBatch,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects", selectedBatch],
    queryFn: () => api.get<ApiResponse<{ id: string; name: string; code: string }[]>>(`/api/subjects/batch/${selectedBatch}`),
    enabled: !!selectedBatch,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post("/api/attendance/session", {
        sectionId: selectedBatch,
        subjectId: selectedSubject,
        date: new Date(date).toISOString(),
        records: Object.entries(records).map(([studentId, status]) => ({ studentId, status })),
      }),
    onSuccess: () => toast.success("Attendance marked successfully!"),
    onError: () => toast.error("Failed to mark attendance"),
  });

  const classes = classesData?.data ?? [];
  const subjects = subjectsData?.data ?? [];
  const students = enrollmentsData?.data ?? [];

  const toggleStatus = (studentId: string, status: AttendanceStatusType) => {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status: AttendanceStatusType) => {
    const allRecords: Record<string, AttendanceStatusType> = {};
    students.forEach((s) => { allRecords[s.student.id] = status; });
    setRecords(allRecords);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mark Attendance</h1>
        <p className="text-muted-foreground">Record student attendance for a class session</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Class</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedBatch}
                onChange={(e) => { setSelectedBatch(e.target.value); setSelectedSubject(""); setRecords({}); }}
              >
                <option value="">Select class...</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subject</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={!selectedBatch}
              >
                <option value="">Select subject...</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedBatch && selectedSubject && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Students ({students.length})</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => markAll("PRESENT")} className="text-xs text-emerald-500">All Present</Button>
                <Button variant="outline" size="sm" onClick={() => markAll("ABSENT")} className="text-xs text-red-500">All Absent</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingEnrollments ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <Skeleton className="h-4 w-32 flex-1" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : students.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No students enrolled in this class</p>
            ) : (
              <div className="space-y-2">
                {students.map((e) => {
                  const status = records[e.student.id];
                  return (
                    <div key={e.student.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <Avatar src={e.student.avatar} name={e.student.name} size="sm" />
                        <span className="text-sm font-medium">{e.student.name}</span>
                      </div>
                      <div className="flex gap-1.5">
                        {(["PRESENT", "ABSENT", "LATE"] as AttendanceStatusType[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => toggleStatus(e.student.id, s)}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                              status === s
                                ? s === "PRESENT" ? "bg-emerald-500 text-white" : s === "ABSENT" ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                                : "border border-border hover:bg-muted"
                            )}
                          >
                            {s === "PRESENT" ? <CheckCircle2 className="h-3 w-3" /> : s === "ABSENT" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || Object.keys(records).length === 0}
              >
                {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Attendance
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
