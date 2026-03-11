"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse } from "@repo/types";
import { Building2, Users, School, Plus } from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string;
  head?: { id: string; name: string; email: string } | null;
  batches: { id: string }[];
}

export default function AdminDepartmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => api.get<ApiResponse<Department[]>>("/api/admin/departments"),
  });

  const departments = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-muted-foreground">Manage academic departments</p>
        </div>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Department</Button>
      </div>

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
            <Card key={dept.id} className="hover:border-primary/30 transition-colors">
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
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><School className="h-3 w-3" />{dept.batches.length} classes</span>
                  {dept.head && <span className="flex items-center gap-1"><Users className="h-3 w-3" />Head: {dept.head.name}</span>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
