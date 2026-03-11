"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse } from "@repo/types";
import { School, Users, Plus } from "lucide-react";

interface Batch {
  id: string;
  name: string;
  year: number;
  semester: number;
  department: { name: string; code: string };
  teacher: { id: string; name: string; email: string };
  _count: { enrollments: number };
}

export default function AdminClassesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-classes"],
    queryFn: () => api.get<ApiResponse<Batch[]>>("/api/admin/classes"),
  });

  const batches = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground">Manage all classes and batches</p>
        </div>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Class</Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Class</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Teacher</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Students</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3"><Skeleton className="h-5 w-40" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-8 ml-auto" /></td>
                </tr>
              ))
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  <School className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>No classes created yet</p>
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{batch.name}</p>
                    <p className="text-xs text-muted-foreground">Year {batch.year} • Sem {batch.semester}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">{batch.department.code}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">{batch.teacher.name}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />{batch._count.enrollments}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
