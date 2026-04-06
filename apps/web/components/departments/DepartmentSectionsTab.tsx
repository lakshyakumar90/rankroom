"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";
import type { ApiResponse } from "@repo/types";
import { EmptyState } from "@/components/common/page-shell";

interface Section {
  id: string;
  name: string;
  code: string;
  semester: number;
  academicYear: string;
  coordinator?: { id: string; name: string } | null;
  _count: { enrollments: number; subjects: number };
}

export function DepartmentSectionsTab({ departmentId }: { departmentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["department", "sections", departmentId],
    queryFn: () => api.get<ApiResponse<Section[]>>(`/api/departments/${departmentId}/sections`),
    enabled: !!departmentId,
  });

  const sections = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <EmptyState
        title="No sections yet"
        description="Add sections to this department to see them here."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map((section) => (
        <Card key={section.id} className="hover:border-primary/30 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold">{section.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{section.code}</p>
              </div>
              <Badge variant="outline">Sem {section.semester}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {section._count.enrollments} students
              </span>
              <span>{section._count.subjects} subjects</span>
              <span>{section.academicYear}</span>
            </div>
            {section.coordinator && (
              <p className="text-xs text-muted-foreground mb-3">
                Coordinator: {section.coordinator.name}
              </p>
            )}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={`/sections/${section.id}`}>
                Open section <ArrowRight className="ml-2 size-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
