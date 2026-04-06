"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import type { ApiResponse, HackathonEligibility } from "@repo/types";
import {
  CalendarDays,
  Trophy,
  Users,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

interface TeamMember {
  user: { id: string; name: string; avatar?: string | null };
}

interface TeamDetail {
  id: string;
  name: string;
  teamCode?: string | null;
  leader: { id: string; name: string };
  members: TeamMember[];
}

interface RegistrationItem {
  id: string;
  student: { id: string; name: string; email?: string; avatar?: string | null };
  eligibilityNote?: string | null;
  status?: string;
  phoneNumberSnapshot?: string | null;
  team?: { id: string; name: string } | null;
}

interface WinnerEntry {
  id: string;
  rank: number;
  teamName: string;
  projectTitle?: string | null;
  submissionUrl?: string | null;
  notes?: string | null;
  memberSnapshot: Array<{ name: string; email?: string | null; phoneNumber?: string | null; avatar?: string | null }>;
}

interface HackathonDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  minSkills: string[];
  minProjects: number;
  minLeetcode: number;
  minCgpa?: number | null;
  prizeDetails?: string | null;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  minTeamSize: number;
  maxTeamSize: number;
  department?: { id: string; name: string; code: string } | null;
  eligibility?: HackathonEligibility;
  registrations?: RegistrationItem[];
  winnerEntries?: WinnerEntry[];
  teams?: TeamDetail[];
  viewerState?: {
    registrationState: { status: string; canRegister?: boolean; reason?: string | null };
    teamState: { status: string; teamId?: string; teamName?: string; memberCount?: number };
    ownTeam?: TeamDetail | null;
    isStaff: boolean;
  };
}

const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "TEACHER", "CLASS_COORDINATOR", "DEPARTMENT_HEAD"];

export default function HackathonDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const { data, isLoading } = useQuery({
    queryKey: ["hackathon", params.id],
    queryFn: () => api.get<ApiResponse<HackathonDetail>>(`/api/hackathons/${params.id}`),
    enabled: !!params.id,
  });
  const [winnerDrafts, setWinnerDrafts] = useState<Array<{
    rank: number;
    teamName: string;
    projectTitle: string;
    submissionUrl: string;
    notes: string;
    membersText: string;
  }>>([
    { rank: 1, teamName: "", projectTitle: "", submissionUrl: "", notes: "", membersText: "" },
    { rank: 2, teamName: "", projectTitle: "", submissionUrl: "", notes: "", membersText: "" },
    { rank: 3, teamName: "", projectTitle: "", submissionUrl: "", notes: "", membersText: "" },
  ]);

  const registerMutation = useMutation({
    mutationFn: () => api.post(`/api/hackathons/${params.id}/register`, {}),
    onSuccess: () => {
      toast.success("Registered successfully");
      void queryClient.invalidateQueries({ queryKey: ["hackathon", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["hackathons"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to register"),
  });

  const winnersMutation = useMutation({
    mutationFn: () =>
      api.put(`/api/hackathons/${params.id}/winners`, {
        winners: winnerDrafts
          .filter((draft) => draft.teamName.trim())
          .map((draft) => ({
            rank: draft.rank,
            teamName: draft.teamName.trim(),
            projectTitle: draft.projectTitle.trim() || null,
            submissionUrl: draft.submissionUrl.trim() || null,
            notes: draft.notes.trim() || null,
            memberSnapshot: draft.membersText
              .split(",")
              .map((name) => name.trim())
              .filter(Boolean)
              .map((name) => ({ name })),
          })),
      }),
    onSuccess: () => {
      toast.success("Winners updated");
      void queryClient.invalidateQueries({ queryKey: ["hackathon", params.id] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save winners"),
  });

  const hackathon = data?.data;
  const isStudent = user?.role === "STUDENT";
  const isStaff = user ? STAFF_ROLES.includes(user.role) : false;
  const viewerIsStaff = hackathon?.viewerState?.isStaff ?? isStaff;

  const regState = hackathon?.viewerState?.registrationState;
  const isRegistered = regState?.status === "REGISTERED";
  const isPending = regState?.status === "PENDING";
  const canRegister = regState?.status === "NOT_REGISTERED" && (regState.canRegister ?? true);

  const unmetItems = hackathon
    ? buildUnmetEligibilityItems(hackathon)
    : [];

  useEffect(() => {
    if (!hackathon?.winnerEntries) return;
    setWinnerDrafts([
      1, 2, 3,
    ].map((rank) => {
      const winner = hackathon.winnerEntries?.find((entry) => entry.rank === rank);
      return {
        rank,
        teamName: winner?.teamName ?? "",
        projectTitle: winner?.projectTitle ?? "",
        submissionUrl: winner?.submissionUrl ?? "",
        notes: winner?.notes ?? "",
        membersText: winner?.memberSnapshot.map((member) => member.name).join(", ") ?? "",
      };
    }));
  }, [hackathon?.winnerEntries]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="size-8 text-muted-foreground" />
        <p className="text-muted-foreground">Hackathon not found</p>
        <Link href="/hackathons">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Back to Hackathons
          </Button>
        </Link>
      </div>
    );
  }

  const now = new Date();
  const regDeadline = new Date(hackathon.registrationDeadline);
  const isRegOpen = now < regDeadline;

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      {/* Back link */}
      <Link href="/hackathons" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-4" />
        Back to Hackathons
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{hackathon.status.replace("_", " ")}</Badge>
          <Badge variant="secondary">{hackathon.department?.name ?? "Global / Open"}</Badge>
          {isRegOpen && <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">Registration Open</Badge>}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{hackathon.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{hackathon.description}</p>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Registration closes {formatDateTime(hackathon.registrationDeadline)}
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Starts {formatDateTime(hackathon.startDate)}
            </div>
            <div className="text-xs">Ends {formatDateTime(hackathon.endDate)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Offline registration event
            </div>
            {hackathon.prizeDetails && (
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                {hackathon.prizeDetails}
              </div>
            )}
            {viewerIsStaff && (
              <div className="text-xs">
                {hackathon.registrations?.length ?? 0} registrations
                {hackathon.winnerEntries?.length ? ` · ${hackathon.winnerEntries.length} winners recorded` : ""}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Eligibility / Action card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eligibility & Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isStudent ? (
              <>
                {hackathon.eligibility?.isEligible ? (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    <span>You meet all eligibility requirements</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div>
                        <p>{hackathon.eligibility?.reason ?? "Eligibility criteria not met"}</p>
                        {hackathon.eligibility?.unmetCriteria?.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs opacity-90">
                            {hackathon.eligibility.unmetCriteria.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>

                    {unmetItems.length > 0 ? (
                      <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
                        <p className="text-xs font-medium text-foreground">What to fix in your profile</p>
                        <div className="mt-2 space-y-2">
                          {unmetItems.map((item) => (
                            <div key={item.label} className="rounded-md border border-border/60 bg-background/70 px-2.5 py-2 text-xs">
                              <p className="font-medium text-foreground">{item.label}</p>
                              <p className="mt-1 text-muted-foreground">Required: {item.required}</p>
                              <p className="text-muted-foreground">Current: {item.current}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <Button asChild variant="outline" size="sm" className="gap-2">
                            <Link href="/profile/edit">
                              <Zap className="size-3.5" />
                              Update Profile
                            </Link>
                          </Button>
                          {hackathon.eligibility?.missingSkills?.length ? (
                            <Button asChild variant="outline" size="sm" className="gap-2">
                              <Link href="/skills">
                                <Zap className="size-3.5" />
                                Add Skills
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                {isRegistered ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                    <CheckCircle2 className="size-4" />
                    Registered
                  </div>
                ) : isPending ? (
                  <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600">
                    <Clock className="size-4" />
                    Registration Pending
                  </div>
                ) : canRegister && hackathon.eligibility?.isEligible ? (
                  <Button
                    className="w-full"
                    onClick={() => registerMutation.mutate()}
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "Registering..." : "Register Now"}
                  </Button>
                ) : null}

                {!canRegister && regState?.reason ? (
                  <p className="text-xs text-muted-foreground">{regState.reason}</p>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                {viewerIsStaff ? "Staff / Organizer View — full participant data below" : "Log in to participate"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organizer: Registrations table */}
      {viewerIsStaff && hackathon.registrations && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Registered Participants</span>
              <Badge variant="outline">{hackathon.registrations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hackathon.registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No registrations yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Eligibility</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hackathon.registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar src={reg.student.avatar} name={reg.student.name} size="sm" />
                          <span className="font-medium text-sm">{reg.student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{reg.student.email ?? "—"}</TableCell>
                      <TableCell className="text-sm">{reg.phoneNumberSnapshot ?? <span className="text-muted-foreground text-xs">No phone saved</span>}</TableCell>
                      <TableCell>
                        {reg.eligibilityNote ? (
                          <span className="text-xs text-muted-foreground">{reg.eligibilityNote}</span>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 text-xs">Eligible</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{reg.status ?? "REGISTERED"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {(hackathon.winnerEntries?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Winners</span>
              <Badge variant="outline">{hackathon.winnerEntries?.length ?? 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hackathon.winnerEntries?.map((winner) => (
                <div key={winner.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">#{winner.rank} {winner.teamName}</p>
                      <p className="text-xs text-muted-foreground">{winner.projectTitle ?? "Winner entry"}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {winner.memberSnapshot.length} member{winner.memberSnapshot.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {winner.memberSnapshot.map((member, index) => (
                      <div key={`${winner.id}-${index}`} className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs">
                        <Avatar src={member.avatar} name={member.name} size="sm" className="size-4" />
                        {member.name}
                      </div>
                    ))}
                  </div>
                  {winner.notes ? <p className="mt-2 text-xs text-muted-foreground">{winner.notes}</p> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {viewerIsStaff ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Winners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {winnerDrafts.map((draft, index) => (
              <div key={draft.rank} className="grid gap-3 rounded-lg border border-border p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input value={draft.rank} readOnly />
                  <Input
                    value={draft.teamName}
                    onChange={(e) => setWinnerDrafts((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, teamName: e.target.value } : entry))}
                    placeholder={`Rank ${draft.rank} team name`}
                  />
                  <Input
                    value={draft.projectTitle}
                    onChange={(e) => setWinnerDrafts((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, projectTitle: e.target.value } : entry))}
                    placeholder="Project title"
                  />
                </div>
                <Input
                  value={draft.submissionUrl}
                  onChange={(e) => setWinnerDrafts((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, submissionUrl: e.target.value } : entry))}
                  placeholder="Optional submission URL"
                />
                <Input
                  value={draft.membersText}
                  onChange={(e) => setWinnerDrafts((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, membersText: e.target.value } : entry))}
                  placeholder="Members as comma separated names"
                />
                <Textarea
                  value={draft.notes}
                  onChange={(e) => setWinnerDrafts((prev) => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, notes: e.target.value } : entry))}
                  placeholder="Notes"
                />
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={() => winnersMutation.mutate()} disabled={winnersMutation.isPending}>
                {winnersMutation.isPending ? "Saving..." : "Save winners"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

              function buildUnmetEligibilityItems(hackathon: HackathonDetail) {
                const eligibility = hackathon.eligibility;

                if (!eligibility || eligibility.isEligible) {
                  return [];
                }

                const items: Array<{ label: string; required: string; current: string }> = [];

                if (hackathon.minSkills.length > 0 && eligibility.missingSkills?.length) {
                  items.push({
                    label: "Skills",
                    required: `Any one of: ${hackathon.minSkills.join(", ")}`,
                    current: `Missing: ${eligibility.missingSkills.join(", ")}`,
                  });
                }

                if (eligibility.currentProjects !== undefined && eligibility.currentProjects < hackathon.minProjects) {
                  items.push({
                    label: "Projects",
                    required: `${hackathon.minProjects}+ projects`,
                    current: `${eligibility.currentProjects}`,
                  });
                }

                if (eligibility.currentLeetcode !== undefined && eligibility.currentLeetcode < hackathon.minLeetcode) {
                  items.push({
                    label: "LeetCode solved",
                    required: `${hackathon.minLeetcode}+ solved problems`,
                    current: `${eligibility.currentLeetcode}`,
                  });
                }

                if (hackathon.minCgpa !== null && hackathon.minCgpa !== undefined) {
                  const currentCgpa = eligibility.currentCgpa;
                  if (currentCgpa === null || currentCgpa === undefined || currentCgpa < hackathon.minCgpa) {
                    items.push({
                      label: "CGPA",
                      required: `${hackathon.minCgpa.toFixed(2)}+`,
                      current: currentCgpa === null || currentCgpa === undefined ? "Not set" : currentCgpa.toFixed(2),
                    });
                  }
                }

                return items;
              }