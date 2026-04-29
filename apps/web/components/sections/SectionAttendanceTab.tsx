"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/page-shell";
import type { ApiResponse } from "@repo/types";

interface AttendanceSummary {
  sessionId: string;
  date: string;
  topic?: string | null;
  subject: { id: string; name: string; code: string };
  present: number;
  late: number;
  absent: number;
  total: number;
  percentage: number;
}

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function SectionAttendanceTab({ sectionId }: { sectionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["section", sectionId, "attendance"],
    queryFn: () => api.get<ApiResponse<AttendanceSummary[]>>(`/api/sections/${sectionId}/attendance`),
    enabled: !!sectionId,
  });

  const sessions = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="No attendance sessions yet"
        description="Attendance marked by teachers will appear here for admins, coordinators, and assigned teachers."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Subject</th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground md:table-cell">Topic</th>
            <th className="hidden px-4 py-3 text-center text-xs font-medium text-muted-foreground lg:table-cell">Present</th>
            <th className="hidden px-4 py-3 text-center text-xs font-medium text-muted-foreground lg:table-cell">Late</th>
            <th className="hidden px-4 py-3 text-center text-xs font-medium text-muted-foreground lg:table-cell">Absent</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Attendance</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.sessionId} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3 text-sm">{formatSessionDate(session.date)}</td>
              <td className="px-4 py-3">
                <p className="text-sm font-medium">{session.subject.name}</p>
                <p className="text-xs text-muted-foreground">{session.subject.code}</p>
              </td>
              <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                {session.topic ?? "—"}
              </td>
              <td className="hidden px-4 py-3 text-center text-sm lg:table-cell">{session.present}</td>
              <td className="hidden px-4 py-3 text-center text-sm lg:table-cell">{session.late}</td>
              <td className="hidden px-4 py-3 text-center text-sm lg:table-cell">{session.absent}</td>
              <td className="px-4 py-3 text-right">
                <Badge variant={session.percentage >= 75 ? "default" : "destructive"} className="text-xs">
                  {session.percentage}% of {session.total}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
