"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth";
import { Role, type ApiResponse, type Assignment, type AssignmentSubmission } from "@repo/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { BookOpen, Clock, CheckCircle2, Plus } from "lucide-react";
import Link from "next/link";

export default function AssignmentsPage() {
  const { user } = useAuthStore();

  // Teacher/admin needs a batchId — simplified here to show all via admin
  const { data, isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => api.get<ApiResponse<(Assignment & { mySubmission?: AssignmentSubmission | null; subject: { name: string }; teacher: { name: string }; _count: { submissions: number } })[]>>("/api/assignments/class/all"),
    enabled: !!user,
  });

  const assignments = data?.data ?? [];

  const getStatusBadge = (sub?: AssignmentSubmission | null) => {
    if (!sub) return <Badge variant="outline" className="text-xs">Not Submitted</Badge>;
    if (sub.status === "GRADED") return <Badge className="text-xs bg-emerald-500/15 text-emerald-500 border-emerald-500/20">Graded: {sub.score}pts</Badge>;
    if (sub.status === "LATE") return <Badge variant="destructive" className="text-xs">Late</Badge>;
    return <Badge variant="secondary" className="text-xs">Submitted</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">Track and submit your assignments</p>
        </div>
        {(user?.role === Role.TEACHER || user?.role === Role.ADMIN) && (
          <Link href="/assignments/create">
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Create</Button>
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-full mb-3" />
                <div className="flex gap-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-24" /></div>
              </CardContent>
            </Card>
          ))
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No assignments available</p>
          </div>
        ) : (
          assignments.map((a) => {
            const isOverdue = new Date(a.dueDate) < new Date() && !a.mySubmission;
            return (
              <Link key={a.id} href={`/assignments/${a.id}`}>
                <Card className={`cursor-pointer hover:border-primary/30 transition-colors ${isOverdue ? "border-red-500/30" : ""}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{a.title}</h3>
                          {user?.role === Role.STUDENT && getStatusBadge(a.mySubmission)}
                          {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Due {formatDateTime(a.dueDate)}</span>
                          <span>Max: {a.maxScore} pts</span>
                          <span>{a.subject.name}</span>
                          <span>by {a.teacher.name}</span>
                        </div>
                      </div>
                      {user?.role !== Role.STUDENT && (
                        <div className="text-right text-sm">
                          <p className="font-medium">{a._count.submissions}</p>
                          <p className="text-muted-foreground text-xs">submissions</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
