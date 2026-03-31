"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiResponse } from "@repo/types";
import { BookOpen, Plus, School, Users } from "lucide-react";
import { toast } from "sonner";

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface AdminSection {
  id: string;
  name: string;
  code: string;
  semester: number;
  academicYear: string;
  department: { id: string; name: string; code: string };
  legacyTeacher?: { id: string; name: string; email: string; role: string } | null;
  coordinator?: { id: string; name: string; email: string; role: string } | null;
  _count: { enrollments: number; teacherAssignments: number; subjects: number };
}

interface SectionSubject {
  id: string;
  name: string;
  code: string;
  teacherAssignments: Array<{
    id: string;
    teacher: { id: string; name: string; email: string; role: string };
  }>;
}

export default function AdminClassesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [manageSectionId, setManageSectionId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    year: new Date().getFullYear(),
    semester: 1,
    departmentId: "",
    teacherId: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-classes"],
    queryFn: () => api.get<ApiResponse<AdminSection[]>>("/api/admin/classes"),
  });

  const { data: departmentData } = useQuery({
    queryKey: ["admin-departments", "options"],
    queryFn: () => api.get<ApiResponse<DepartmentOption[]>>("/api/admin/departments"),
  });

  const { data: teachersData } = useQuery({
    queryKey: ["admin-users", "teachers"],
    queryFn: () => api.get<ApiResponse<UserOption[]>>("/api/admin/users?limit=100&role=TEACHER"),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/api/admin/classes", createForm),
    onSuccess: () => {
      toast.success("Class created");
      setShowCreate(false);
      setCreateForm({ name: "", year: new Date().getFullYear(), semester: 1, departmentId: "", teacherId: "" });
      void queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create class"),
  });

  const sections = data?.data ?? [];
  const departments = departmentData?.data ?? [];
  const teachers = teachersData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground">Manage sections, enrollments, coordinators, and subject mapping.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((current) => !current)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Class
        </Button>
      </div>

      {showCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Class</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            <Input
              placeholder="Section E2"
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              type="number"
              placeholder="Year"
              value={createForm.year}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, year: Number(event.target.value || new Date().getFullYear()) }))
              }
            />
            <Input
              type="number"
              placeholder="Semester"
              value={createForm.semester}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, semester: Number(event.target.value || 1) }))
              }
            />
            <select
              className="h-9 border border-input bg-background px-3 text-sm"
              value={createForm.departmentId}
              onChange={(event) => setCreateForm((current) => ({ ...current, departmentId: event.target.value }))}
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 border border-input bg-background px-3 text-sm"
              value={createForm.teacherId}
              onChange={(event) => setCreateForm((current) => ({ ...current, teacherId: event.target.value }))}
            >
              <option value="">Assign primary teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
            <div className="sm:col-span-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!createForm.name || !createForm.departmentId || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Class"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-hidden border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Class</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Teacher</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Coordinator</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Counts</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Manage</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="border-b border-border">
                  <td className="px-4 py-3"><Skeleton className="h-5 w-40" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-32" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-5 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-8 w-16" /></td>
                </tr>
              ))
            ) : sections.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <School className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  <p>No classes created yet</p>
                </td>
              </tr>
            ) : (
              sections.map((section) => (
                <Fragment key={section.id}>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{section.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {section.code} • Sem {section.semester} • {section.academicYear}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="outline">{section.department.code}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">
                      {section.legacyTeacher?.name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">
                      {section.coordinator?.name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>{section._count.enrollments} students</p>
                        <p>{section._count.subjects} subjects</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setManageSectionId((current) => (current === section.id ? null : section.id))
                        }
                      >
                        {manageSectionId === section.id ? "Close" : "Manage"}
                      </Button>
                    </td>
                  </tr>
                  {manageSectionId === section.id ? (
                    <tr className="border-b border-border bg-muted/10">
                      <td colSpan={6} className="px-4 py-4">
                        <ManageSectionPanel
                          section={section}
                          teachers={teachers}
                          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["admin-classes"] })}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManageSectionPanel({
  section,
  teachers,
  onSaved,
}: {
  section: AdminSection;
  teachers: UserOption[];
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [coordinatorIds, setCoordinatorIds] = useState<string[]>(section.coordinator ? [section.coordinator.id] : []);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectTeacherId, setSubjectTeacherId] = useState(section.legacyTeacher?.id ?? "");

  const { data: coordinatorsData } = useQuery({
    queryKey: ["admin-users", "coordinators"],
    queryFn: () => api.get<ApiResponse<UserOption[]>>("/api/admin/users?limit=100&role=CLASS_COORDINATOR"),
  });

  const { data: studentsData } = useQuery({
    queryKey: ["admin-users", "students"],
    queryFn: () => api.get<ApiResponse<UserOption[]>>("/api/admin/users?limit=200&role=STUDENT"),
  });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ["admin-class-subjects", section.id],
    queryFn: () => api.get<ApiResponse<SectionSubject[]>>(`/api/admin/classes/${section.id}/subjects`),
  });

  const saveCoordinatorMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/classes/${section.id}/coordinators`, { coordinatorIds }),
    onSuccess: () => {
      toast.success("Coordinator updated");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update coordinator"),
  });

  const enrollMutation = useMutation({
    mutationFn: () => api.post(`/api/admin/classes/${section.id}/enroll`, { studentIds: selectedStudentIds }),
    onSuccess: () => {
      toast.success("Students enrolled");
      setSelectedStudentIds([]);
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to enroll students"),
  });

  const createSubjectMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/classes/${section.id}/subjects`, {
        name: subjectName,
        code: subjectCode,
        teacherId: subjectTeacherId || undefined,
      }),
    onSuccess: () => {
      toast.success("Subject added");
      setSubjectName("");
      setSubjectCode("");
      setSubjectTeacherId(section.legacyTeacher?.id ?? "");
      void queryClient.invalidateQueries({ queryKey: ["admin-class-subjects", section.id] });
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add subject"),
  });

  const coordinatorOptions = coordinatorsData?.data ?? [];
  const studentOptions = studentsData?.data ?? [];
  const subjectItems = subjectsData?.data ?? [];

  const visibleStudents = useMemo(
    () => studentOptions.slice(0, 24),
    [studentOptions]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Coordinator</h3>
        <select
          className="h-9 w-full border border-input bg-background px-3 text-sm"
          value={coordinatorIds[0] ?? ""}
          onChange={(event) => setCoordinatorIds(event.target.value ? [event.target.value] : [])}
        >
          <option value="">No coordinator</option>
          {coordinatorOptions.map((coordinator) => (
            <option key={coordinator.id} value={coordinator.id}>
              {coordinator.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => saveCoordinatorMutation.mutate()} disabled={saveCoordinatorMutation.isPending}>
          Save Coordinator
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Enroll Students</h3>
        <div className="grid max-h-52 gap-2 overflow-y-auto border border-border p-3">
          {visibleStudents.map((student) => (
            <label key={student.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedStudentIds.includes(student.id)}
                onChange={() =>
                  setSelectedStudentIds((current) =>
                    current.includes(student.id)
                      ? current.filter((id) => id !== student.id)
                      : [...current, student.id]
                  )
                }
              />
              <span>{student.name}</span>
            </label>
          ))}
        </div>
        <Button size="sm" onClick={() => enrollMutation.mutate()} disabled={selectedStudentIds.length === 0 || enrollMutation.isPending}>
          <Users className="mr-2 h-4 w-4" />
          Enroll Selected
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Add Subject</h3>
        <Input placeholder="Web Technologies" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} />
        <Input placeholder="WT401" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} />
        <select
          className="h-9 w-full border border-input bg-background px-3 text-sm"
          value={subjectTeacherId}
          onChange={(event) => setSubjectTeacherId(event.target.value)}
        >
          <option value="">Assign teacher later</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={() => createSubjectMutation.mutate()}
          disabled={!subjectName || !subjectCode || createSubjectMutation.isPending}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Subject
        </Button>
      </div>

      <div className="lg:col-span-3 space-y-3">
        <h3 className="text-sm font-semibold">Subjects in this class</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {subjectsLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))
          ) : subjectItems.length === 0 ? (
            <div className="border border-dashed border-border p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              No subjects mapped to this class yet.
            </div>
          ) : (
            subjectItems.map((subject) => (
              <Card key={subject.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{subject.name}</p>
                      <p className="text-xs text-muted-foreground">{subject.code}</p>
                    </div>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {subject.teacherAssignments.length > 0
                      ? `Teacher: ${subject.teacherAssignments.map((entry) => entry.teacher.name).join(", ")}`
                      : "Teacher not assigned yet"}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
