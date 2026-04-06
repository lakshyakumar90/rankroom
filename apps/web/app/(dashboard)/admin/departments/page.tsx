"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse } from "@repo/types";
import { Building2, Users, School, Plus, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
  code: string;
  head?: { id: string; name: string; email: string; role: string } | null;
  sections?: { id: string }[];
  stats?: { sectionsCount: number; studentsCount: number; teachersCount: number; activeContests: number };
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function AdminDepartmentsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", headId: "" });
  const [headSelections, setHeadSelections] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => api.get<ApiResponse<Department[]>>("/api/admin/departments"),
  });

  const { data: headCandidatesData } = useQuery({
    queryKey: ["admin-users", "department-heads"],
    queryFn: () => api.get<ApiResponse<UserOption[]>>("/api/admin/users?limit=100&role=DEPARTMENT_HEAD"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/api/admin/departments", {
        name: form.name,
        code: form.code.toUpperCase(),
        headId: form.headId || undefined,
      }),
    onSuccess: () => {
      toast.success("Department created");
      setForm({ name: "", code: "", headId: "" });
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create department"),
  });

  const assignHeadMutation = useMutation({
    mutationFn: ({ departmentId, headId }: { departmentId: string; headId: string }) =>
      api.patch(`/api/admin/departments/${departmentId}`, { headId: headId || null }),
    onSuccess: () => {
      toast.success("Department head updated");
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update department"),
  });

  const departments = data?.data ?? [];
  const headCandidates = useMemo(() => headCandidatesData?.data ?? [], [headCandidatesData?.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-muted-foreground">Manage academic departments</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((current) => !current)}><Plus className="h-4 w-4 mr-2" />Add Department</Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-4">
            <Input placeholder="Department name" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            <Input placeholder="Code" value={form.code} onChange={(e) => setForm((current) => ({ ...current, code: e.target.value.toUpperCase() }))} />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.headId}
              onChange={(e) => setForm((current) => ({ ...current, headId: e.target.value }))}
            >
              <option value="">No head assigned</option>
              {headCandidates.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.code || createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-16 mb-4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))
        ) : departments.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No departments created yet</p>
          </div>
        ) : (
          departments.map((dept) => (
            <Card key={dept.id} className="hover:border-primary/30 transition-colors group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{dept.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{dept.code}</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><School className="h-3 w-3" />{dept.stats?.sectionsCount ?? dept.sections?.length ?? 0} sections</span>
                  {dept.head && <span className="flex items-center gap-1"><Users className="h-3 w-3" />Head: {dept.head.name}</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link href={`/admin/departments/${dept.id}`}>
                      Open dashboard <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                  <select
                    className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs"
                    value={headSelections[dept.id] ?? dept.head?.id ?? ""}
                    onChange={(e) => setHeadSelections((current) => ({ ...current, [dept.id]: e.target.value }))}
                  >
                    <option value="">No head</option>
                    {headCandidates.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => assignHeadMutation.mutate({ departmentId: dept.id, headId: headSelections[dept.id] ?? dept.head?.id ?? "" })}
                    disabled={assignHeadMutation.isPending}
                  >
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
