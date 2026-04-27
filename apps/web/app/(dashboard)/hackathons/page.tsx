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
import type { ApiResponse, Hackathon } from "@repo/types";
import { CalendarDays, Trophy, Users, Clock, CheckCircle2, ChevronRight, Check, AlertCircle, Zap } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type HackathonListItem = Hackathon;

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
      <div className="rounded-3xl border border-border bg-linear-to-r from-sky-500/15 via-background to-emerald-500/10 p-6">
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
            <Card key={index} className="h-100 animate-pulse rounded-2xl bg-muted/20" />
          ))
        ) : hackathons.length === 0 ? (
          <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl">
            <Trophy className="mx-auto mb-4 size-12 opacity-20" />
            <p>No hackathons or competitions found for this filter.</p>
          </div>
        ) : (
          hackathons.map((hackathon) => {
            const now = new Date();
            const regDeadline = new Date(hackathon.registrationDeadline);
            const start = new Date(hackathon.startDate);
            const end = new Date(hackathon.endDate);

            // Timeline calculations
            const totalDuration = end.getTime() - regDeadline.getTime();
            let progress = 0;
            if (now > end) progress = 100;
            else if (now > regDeadline) {
              progress = ((now.getTime() - regDeadline.getTime()) / totalDuration) * 100;
            }

            const isRegistrationOpen = now < regDeadline;
            const isOngoing = now >= start && now <= end;
            const isFinished = now > end;

            return (
              <Card key={hackathon.id} className="group relative overflow-hidden rounded-2xl border-border/50 transition-all hover:border-primary/40 hover:shadow-lg flex flex-col h-full bg-card">
                <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                
                {/* Image / Header Banner */}
                <div className="relative h-28 bg-linear-to-r from-cyan-500/20 via-emerald-500/15 to-amber-500/20 p-5">
                  <div className="flex items-start justify-between">
                    <Badge variant={hackathon.status === "ONGOING" ? "default" : "secondary"} className="bg-background/80 backdrop-blur-sm">
                      {hackathon.department?.name ?? "Open to All"}
                    </Badge>
                    <Badge variant="outline" className={`bg-background/80 backdrop-blur-sm shadow-sm ${isOngoing ? "border-green-500/50 text-green-600" : ""}`}>
                      {hackathon.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                <CardContent className="relative -mt-6 flex-1 flex flex-col px-5 pb-5">
                  {/* Title & Description */}
                  <div className="mb-6 rounded-xl border border-border bg-background p-4 shadow-sm">
                    <CardTitle className="mb-2 text-lg font-bold leading-tight">
                      {hackathon.title}
                    </CardTitle>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {hackathon.description}
                    </p>
                  </div>

                  {/* Attributes Grid */}
                  <div className="mb-6 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted/50 text-foreground">
                        <Users className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{hackathon.minTeamSize}-{hackathon.maxTeamSize}</p>
                        <p className="text-[10px] uppercase tracking-wider">Members</p>
                      </div>
                    </div>
                    {hackathon.prizeDetails && (
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                          <Trophy className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{hackathon.prizeDetails}</p>
                          <p className="text-[10px] uppercase tracking-wider">Prize Pool</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timeline Progress */}
                  <div className="mb-6 space-y-3 rounded-lg bg-muted/30 p-4 border border-border/50">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className={isRegistrationOpen ? "text-primary font-bold" : "text-muted-foreground"}>Reg. Deadline</span>
                      <span className={isOngoing ? "text-green-600 font-bold" : "text-muted-foreground"}>Results / End</span>
                    </div>
                    
                    <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div 
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${isFinished ? "bg-muted-foreground/50" : isOngoing ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${Math.max(5, progress)}%` }} 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{new Date(hackathon.registrationDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      <span>Starts: {new Date(hackathon.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      <span>{new Date(hackathon.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Footer / Eligibility */}
                  <div className="mt-auto space-y-3 pt-2">
                    {user?.role === "STUDENT" ? (
                      hackathon.eligibility?.isEligible ? (
                        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                          <span>You meet all eligibility requirements</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                            <span>{hackathon.eligibility?.reason ?? "Eligibility criteria not met"}</span>
                          </div>

                          <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                            <p className="font-medium text-foreground">Required to register</p>
                            <ul className="mt-1 space-y-1">
                              {buildHackathonCriteriaSummary(hackathon).map((criteria) => (
                                <li key={criteria} className="truncate">• {criteria}</li>
                              ))}
                            </ul>
                          </div>

                          <Button asChild variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                            <Link href="/settings">
                              <Zap className="size-3.5" />
                              Update Profile for Eligibility
                            </Link>
                          </Button>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <Users className="size-3.5" />
                        <span>{user ? "Organizer / Staff View" : "Login to participate"}</span>
                      </div>
                    )}
                    
                    <Button asChild className="w-full gap-2 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <Link href={`/hackathons/${hackathon.id}`}>
                        View Details <ChevronRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function buildHackathonCriteriaSummary(hackathon: HackathonListItem) {
  const summary: string[] = [];

  if (hackathon.minSkills.length > 0) {
    summary.push(`Any one skill from: ${hackathon.minSkills.join(", ")}`);
  }

  if (hackathon.minProjects > 0) {
    summary.push(`${hackathon.minProjects}+ projects in your profile`);
  }

  if (hackathon.minLeetcode > 0) {
    summary.push(`${hackathon.minLeetcode}+ LeetCode solved`);
  }

  if (hackathon.minCgpa !== null && hackathon.minCgpa !== undefined) {
    summary.push(`CGPA ${hackathon.minCgpa.toFixed(2)} or higher`);
  }

  if (summary.length === 0) {
    summary.push("No special profile thresholds for this event");
  }

  return summary;
}
