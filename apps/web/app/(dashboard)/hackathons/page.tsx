"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApiResponse } from "@repo/types";
import { CalendarDays, Trophy, Users } from "lucide-react";

interface HackathonEligibility {
  isEligible: boolean;
  reason: string;
}

interface HackathonListItem {
  id: string;
  title: string;
  description: string;
  departmentId?: string | null;
  department?: { id: string; name: string; code: string } | null;
  status: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  minTeamSize: number;
  maxTeamSize: number;
  prizeDetails?: string | null;
  eligibility?: HackathonEligibility;
}

const FILTERS = ["All", "Open", "Upcoming", "Ongoing", "Completed"] as const;

export default function HackathonsPage() {
  const user = useAuthStore((state) => state.user);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["hackathons", filter],
    queryFn: () => api.get<ApiResponse<HackathonListItem[]>>("/api/hackathons"),
  });

  const hackathons = useMemo(() => {
    const items = data?.data ?? [];
    if (filter === "All") return items;
    if (filter === "Open") return items.filter((item) => item.status === "REGISTRATION_OPEN");
    if (filter === "Upcoming") return items.filter((item) => item.status === "UPCOMING");
    if (filter === "Ongoing") return items.filter((item) => item.status === "ONGOING");
    return items.filter((item) => item.status === "COMPLETED");
  }, [data?.data, filter]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="rounded-3xl border border-border bg-gradient-to-r from-sky-500/15 via-background to-emerald-500/10 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Hackathons & Competitions</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Discover events, check eligibility, and register with your section or department.
            </p>
          </div>
          <PermissionGate permission="hackathons:create">
            <Button asChild>
              <Link href="/department/hackathons">Manage Department Events</Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item}
            variant={filter === item ? "default" : "outline"}
            onClick={() => setFilter(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="h-72 animate-pulse" />
          ))
        ) : (
          hackathons.map((hackathon) => (
            <Card key={hackathon.id} className="overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-cyan-500/25 via-emerald-500/20 to-amber-500/20" />
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="secondary" className="mb-3">
                      {hackathon.department?.name ?? "Open"}
                    </Badge>
                    <CardTitle className="text-lg">{hackathon.title}</CardTitle>
                  </div>
                  <Badge variant="outline">{hackathon.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {hackathon.description}
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4" />
                    {new Date(hackathon.startDate).toLocaleDateString()} -{" "}
                    {new Date(hackathon.endDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-4" />
                    {hackathon.minTeamSize}-{hackathon.maxTeamSize} members
                  </div>
                  {hackathon.prizeDetails && (
                    <div className="flex items-center gap-2">
                      <Trophy className="size-4" />
                      {hackathon.prizeDetails}
                    </div>
                  )}
                </div>
                {user?.role === "STUDENT" ? (
                  <div
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      hackathon.eligibility?.isEligible
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {hackathon.eligibility?.isEligible
                      ? "You're eligible to register"
                      : hackathon.eligibility?.reason ?? "Eligibility unavailable"}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {user ? "Organizer view" : "Login to check eligibility"}
                  </div>
                )}
                <Button asChild className="w-full">
                  <Link href={`/hackathons/${hackathon.id}`}>View details</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
