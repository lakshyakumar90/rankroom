"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CalendarDays, Users, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/page-shell";
import type { ApiResponse } from "@repo/types";

type HackathonStatus = "DRAFT" | "UPCOMING" | "REGISTRATION_OPEN" | "ONGOING" | "COMPLETED" | "CANCELLED";

interface DepartmentHackathon {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: HackathonStatus;
  _count: { registrations: number; teams: number };
}

const statusVariant: Record<HackathonStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  UPCOMING: "secondary",
  REGISTRATION_OPEN: "default",
  ONGOING: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
};

export function DepartmentHackathonsTab({ departmentId }: { departmentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["department", "hackathons", departmentId],
    queryFn: () => api.get<ApiResponse<DepartmentHackathon[]>>(`/api/departments/${departmentId}/hackathons`),
    enabled: !!departmentId,
  });

  const hackathons = data?.data ?? [];

  if (isLoading) {
    return <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20" />)}</div>;
  }

  if (hackathons.length === 0) {
    return <EmptyState title="No hackathons" description="Department hackathons, teams, and registrations will appear here." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Event</th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground md:table-cell">Starts</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground md:table-cell">Participation</th>
            <th className="sr-only">Actions</th>
          </tr>
        </thead>
        <tbody>
          {hackathons.map((hackathon) => (
            <tr key={hackathon.id} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" />
                  <span className="text-sm font-medium">{hackathon.title}</span>
                </div>
              </td>
              <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                {formatDistanceToNow(new Date(hackathon.startDate), { addSuffix: true })}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[hackathon.status]} className="text-xs capitalize">
                  {hackathon.status.replace(/_/g, " ").toLowerCase()}
                </Badge>
              </td>
              <td className="hidden px-4 py-3 text-sm md:table-cell">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Users className="size-3" />
                  {hackathon._count.registrations} registrations · {hackathon._count.teams} teams
                </span>
              </td>
              <td className="px-4 py-3">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/hackathons/${hackathon.id}`}>
                    View <ArrowRight className="ml-1 size-3" />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
