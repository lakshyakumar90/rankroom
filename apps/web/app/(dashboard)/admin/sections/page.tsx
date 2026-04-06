"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, ChevronRight, Users, BookOpen, GraduationCap } from "lucide-react";
import type { ApiResponse } from "@repo/types";

interface Section {
  id: string;
  name: string;
  code: string;
  semester: number;
  academicYear: string;
  department: { id: string; name: string; code: string };
  _count: { enrollments: number; subjects: number };
  coordinators?: { id: string; name: string }[];
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function AdminSectionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: sectionsRes, isLoading } = useQuery({
    queryKey: ["admin-sections"],
    queryFn: () => api.get<ApiResponse<Section[]>>("/api/sections"),
  });

  const { data: deptsRes } = useQuery({
    queryKey: ["departments-list"],
    queryFn: () => api.get<ApiResponse<Department[]>>("/api/departments"),
  });

  const sections = sectionsRes?.data ?? [];
  const departments = deptsRes?.data ?? [];

  const filtered = sections.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || s.department.id === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage academic sections across all departments
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="size-4" />
          New Section
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search sections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Sections", value: sections.length, icon: BookOpen },
          {
            label: "Total Students",
            value: sections.reduce((acc, s) => acc + (s._count?.enrollments ?? 0), 0),
            icon: Users,
          },
          {
            label: "Total Subjects",
            value: sections.reduce((acc, s) => acc + (s._count?.subjects ?? 0), 0),
            icon: GraduationCap,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border bg-card p-4 flex items-center gap-3"
          >
            <div className="p-2 rounded-md bg-muted">
              <stat.icon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              {isLoading ? (
                <Skeleton className="h-5 w-12 mt-1" />
              ) : (
                <p className="text-lg font-semibold">{Number.isFinite(stat.value) ? stat.value : 0}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Subjects</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No sections found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((section) => (
                <TableRow key={section.id} className="cursor-pointer group">
                  <TableCell>
                    <Link
                      href={`/sections/${section.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      {section.name}
                      <Badge variant="outline" className="font-mono text-xs">
                        {section.code}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {section.department.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Sem {section.semester}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {section.academicYear}
                  </TableCell>
                  <TableCell className="text-sm">{section._count.enrollments}</TableCell>
                  <TableCell className="text-sm">{section._count.subjects}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/sections/${section.id}`}>
                        <Button variant="ghost" size="icon" className="size-7">
                          <ChevronRight className="size-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateSectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        departments={departments}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-sections"] });
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function CreateSectionDialog({
  open,
  onOpenChange,
  departments,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: Department[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    semester: "1",
    academicYear: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
    departmentId: "",
  });

  const mutation = useMutation({
    mutationFn: () => api.post("/api/sections", form),
    onSuccess: () => {
      toast.success("Section created");
      onSuccess();
    },
    onError: () => toast.error("Failed to create section"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Section</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. CS-A"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Code</label>
              <Input
                placeholder="e.g. CSA"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Department</label>
            <Select
              value={form.departmentId}
              onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Semester</label>
              <Select
                value={form.semester}
                onValueChange={(v) => setForm((f) => ({ ...f, semester: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Semester {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Academic Year</label>
              <Input
                placeholder="2025-2026"
                value={form.academicYear}
                onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.name || !form.code || !form.departmentId || mutation.isPending}
          >
            {mutation.isPending ? "Creating..." : "Create Section"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
