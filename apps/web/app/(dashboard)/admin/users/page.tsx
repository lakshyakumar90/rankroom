"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Role, type ApiResponse } from "@repo/types";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string | null;
  createdAt: string;
  isVerified: boolean;
  githubUsername?: string | null;
  profile?: {
    handle?: string | null;
    bio?: string | null;
    college?: string | null;
    batch?: string | null;
    department?: string | null;
    isPublic: boolean;
  } | null;
  departmentHeaded?: { id: string; name: string; code: string } | null;
  teachingAssignments?: Array<{
    subject: {
      id: string;
      name: string;
      code: string;
    };
  }>;
  enrollments?: Array<{
    sectionId: string;
    section: {
      id: string;
      name: string;
      code: string;
      academicYear: string;
      department: { id: string; name: string; code: string };
    };
  }>;
}

interface SectionOption {
  id: string;
  name: string;
  code: string;
  academicYear: string;
  department: { name: string; code: string };
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: Role.STUDENT,
    departmentId: "",
    sectionId: "",
    subjectIds: [] as string[],
  });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      return api.get<ApiResponse<UserRecord[]>>(`/api/admin/users?${params}`);
    },
  });

  const { data: sectionsData } = useQuery({
    queryKey: ["admin-sections", "options"],
    queryFn: () => api.get<ApiResponse<SectionOption[]>>("/api/sections"),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ["admin-departments", "options"],
    queryFn: () => api.get<ApiResponse<DepartmentOption[]>>("/api/admin/departments"),
  });

  const { data: createSubjectsData } = useQuery({
    queryKey: ["admin-subject-options", createForm.sectionId],
    queryFn: () => api.get<ApiResponse<SubjectOption[]>>(`/api/admin/classes/${createForm.sectionId}/subjects`),
    enabled: !!createForm.sectionId && [Role.TEACHER, Role.CLASS_COORDINATOR].includes(createForm.role),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}`),
    onSuccess: () => {
      toast.success("User deleted");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/api/admin/users", createForm),
    onSuccess: () => {
      toast.success("User created");
      setCreateForm({ name: "", email: "", password: "", role: Role.STUDENT, departmentId: "", sectionId: "", subjectIds: [] });
      setShowCreate(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create user"),
  });

  const users = data?.data ?? [];
  const sections = sectionsData?.data ?? [];
  const departments = departmentsData?.data ?? [];
  const createSubjects = createSubjectsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage accounts, student academic identity, and profile visibility.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((current) => !current)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {showCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Full name"
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              />
              <Input
                placeholder="Email"
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              />
              <Input
                placeholder="Temporary password"
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
              />
              <select
                className="h-9 border border-input bg-background px-3 text-sm"
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: event.target.value as Role,
                    departmentId: "",
                    sectionId: "",
                    subjectIds: [],
                  }))
                }
              >
                {Object.values(Role).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              {createForm.role === Role.STUDENT || createForm.role === Role.TEACHER || createForm.role === Role.CLASS_COORDINATOR ? (
                <select
                  className="h-9 border border-input bg-background px-3 text-sm"
                  value={createForm.sectionId}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, sectionId: event.target.value, subjectIds: [] }))
                  }
                >
                  <option value="">Select section</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name} · {section.department.code} · {section.academicYear}
                    </option>
                  ))}
                </select>
              ) : null}
              {createForm.role === Role.DEPARTMENT_HEAD ? (
                <select
                  className="h-9 border border-input bg-background px-3 text-sm sm:col-span-2"
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
              ) : null}
              {(createForm.role === Role.TEACHER || createForm.role === Role.CLASS_COORDINATOR) && createForm.sectionId ? (
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Subjects</p>
                  <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                    {createSubjects.length > 0 ? (
                      createSubjects.map((subject) => (
                        <label key={subject.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={createForm.subjectIds.includes(subject.id)}
                            onChange={(event) =>
                              setCreateForm((current) => ({
                                ...current,
                                subjectIds: event.target.checked
                                  ? [...current.subjectIds, subject.id]
                                  : current.subjectIds.filter((id) => id !== subject.id),
                              }))
                            }
                          />
                          <span>{subject.code} · {subject.name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No subjects available in this section yet.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={
                  !createForm.name ||
                  !createForm.email ||
                  !createForm.password ||
                  (createForm.role === Role.DEPARTMENT_HEAD && !createForm.departmentId) ||
                  ([Role.STUDENT, Role.TEACHER, Role.CLASS_COORDINATOR].includes(createForm.role) && !createForm.sectionId) ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {["", ...Object.values(Role)].map((role) => (
            <Button key={role} variant={roleFilter === role ? "default" : "outline"} size="sm" onClick={() => setRoleFilter(role)}>
              {role || "All"}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Section</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Joined</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <tr key={index} className="border-b border-border">
                  <td className="px-4 py-3"><Skeleton className="h-10 w-44" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-8 w-20" /></td>
                </tr>
              ))
            ) : (
              users.map((user) => (
                <Fragment key={user.id}>
                  <tr className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatar} name={user.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="outline">{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">
                      {user.enrollments?.[0]?.section.name ?? "Not assigned"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingUserId((current) => current === user.id ? null : user.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {editingUserId === user.id ? "Close" : "Manage"}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(user.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {editingUserId === user.id ? (
                    <tr className="border-b border-border bg-muted/10">
                      <td colSpan={5} className="px-4 py-4">
                        <ManageUserPanel
                          user={user}
                          sections={sections}
                          departments={departments}
                          onSaved={() => {
                            setEditingUserId(null);
                            void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
                          }}
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

function ManageUserPanel({
  user,
  sections,
  departments,
  onSaved,
}: {
  user: UserRecord;
  sections: SectionOption[];
  departments: DepartmentOption[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    handle: user.profile?.handle ?? "",
    githubUsername: user.githubUsername ?? "",
    bio: user.profile?.bio ?? "",
    college: user.profile?.college ?? "",
    batch: user.profile?.batch ?? "",
    department: user.profile?.department ?? "",
    isPublic: user.profile?.isPublic ?? false,
    sectionId: user.enrollments?.[0]?.sectionId ?? "",
    departmentId: user.departmentHeaded?.id ?? "",
    subjectIds: user.teachingAssignments?.map((assignment) => assignment.subject.id) ?? [],
  });

  const { data: subjectsData } = useQuery({
    queryKey: ["admin-user-subject-options", form.sectionId],
    queryFn: () => api.get<ApiResponse<SubjectOption[]>>(`/api/admin/classes/${form.sectionId}/subjects`),
    enabled: !!form.sectionId && [Role.TEACHER, Role.CLASS_COORDINATOR].includes(user.role),
  });

  const availableSubjects = subjectsData?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/api/admin/users/${user.id}`, form),
    onSuccess: () => {
      toast.success("User updated");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update user"),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <p className="text-sm font-semibold">Profile controls</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" />
          <Input value={form.handle} onChange={(event) => setForm((current) => ({ ...current, handle: event.target.value }))} placeholder="Public handle" />
          <Input value={form.githubUsername} onChange={(event) => setForm((current) => ({ ...current, githubUsername: event.target.value }))} placeholder="GitHub username" />
          <Input value={form.college} onChange={(event) => setForm((current) => ({ ...current, college: event.target.value }))} placeholder="College / institute" />
        </div>
        <textarea
          className="min-h-28 w-full border border-input bg-background px-3 py-2 text-sm"
          value={form.bio}
          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
          placeholder="Bio"
        />
      </div>

      <div className="space-y-4">
        <p className="text-sm font-semibold">Academic identity</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={form.batch} onChange={(event) => setForm((current) => ({ ...current, batch: event.target.value }))} placeholder="Sessional year" />
          <Input value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} placeholder="Department label" />
          {user.role === Role.DEPARTMENT_HEAD ? (
            <select
              className="h-9 border border-input bg-background px-3 text-sm sm:col-span-2"
              value={form.departmentId}
              onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}
            >
              <option value="">No department linked</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          ) : null}
          {user.role === Role.STUDENT ? (
            <select
              className="h-9 border border-input bg-background px-3 text-sm sm:col-span-2"
              value={form.sectionId}
              onChange={(event) => setForm((current) => ({ ...current, sectionId: event.target.value }))}
            >
              <option value="">No section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name} · {section.department.code} · {section.academicYear}
                </option>
              ))}
            </select>
          ) : null}
          {(user.role === Role.TEACHER || user.role === Role.CLASS_COORDINATOR) ? (
            <>
              <select
                className="h-9 border border-input bg-background px-3 text-sm sm:col-span-2"
                value={form.sectionId}
                onChange={(event) => setForm((current) => ({ ...current, sectionId: event.target.value, subjectIds: [] }))}
              >
                <option value="">Select teaching section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name} · {section.department.code} · {section.academicYear}
                  </option>
                ))}
              </select>
              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Assigned subjects</p>
                <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                  {availableSubjects.length > 0 ? (
                    availableSubjects.map((subject) => (
                      <label key={subject.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.subjectIds.includes(subject.id)}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              subjectIds: event.target.checked
                                ? [...current.subjectIds, subject.id]
                                : current.subjectIds.filter((id) => id !== subject.id),
                            }))
                          }
                        />
                        <span>{subject.code} · {subject.name}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Choose a section to assign subjects.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) => setForm((current) => ({ ...current, isPublic: event.target.checked }))}
            />
            Public profile visible
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save User"}
          </Button>
        </div>
      </div>
    </div>
  );
}
