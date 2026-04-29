"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Label } from "@/components/ui/label";
import type { ApiResponse, Hackathon } from "@repo/types";
import { CalendarDays, Trophy } from "lucide-react";
import { toast } from "sonner";

type HackathonListItem = Hackathon;

function getHackathonDisplayStatus(hackathon: Pick<HackathonListItem, "status" | "registrationDeadline" | "startDate" | "endDate">) {
  const now = Date.now();
  const registrationDeadline = new Date(hackathon.registrationDeadline).getTime();
  const startDate = new Date(hackathon.startDate).getTime();
  const endDate = new Date(hackathon.endDate).getTime();

  if (hackathon.status === "CANCELLED") return "CANCELLED";
  if (Number.isFinite(endDate) && endDate <= now) return "COMPLETED";
  if (Number.isFinite(startDate) && startDate <= now && endDate > now) return "ONGOING";
  if (Number.isFinite(registrationDeadline) && registrationDeadline > now && startDate > now) return "REGISTRATION_OPEN";
  return hackathon.status;
}

interface ClassOption {
  id: string;
  name: string;
}

interface StudentOption {
  student: { id: string; name: string };
}

export default function DepartmentHackathonsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const departmentId = user?.scope.primaryDepartmentId ?? "";
  const [showCreate, setShowCreate] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    registrationDeadline: "",
    minTeamSize: 1,
    maxTeamSize: 4,
    minProjects: 0,
    minLeetcode: 0,
    minCgpa: "",
    prizeDetails: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["department", "hackathons", departmentId],
    queryFn: () => api.get<ApiResponse<HackathonListItem[]>>("/api/hackathons"),
    enabled: !!user,
  });

  const { data: classesData } = useQuery({
    queryKey: ["hackathons-manage", "classes"],
    queryFn: () => api.get<ApiResponse<ClassOption[]>>("/api/users/me/classes"),
    enabled: !!user,
  });

  const { data: studentsData } = useQuery({
    queryKey: ["hackathons-manage", "students", targetSectionId],
    queryFn: () => api.get<ApiResponse<StudentOption[]>>(`/api/users/section/${targetSectionId}/students`),
    enabled: !!targetSectionId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/api/hackathons", {
        ...form,
        departmentId: departmentId || undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        registrationDeadline: new Date(form.registrationDeadline).toISOString(),
        minCgpa: form.minCgpa ? Number(form.minCgpa) : undefined,
        participantIds,
      }),
    onSuccess: () => {
      toast.success("Hackathon created");
      setShowCreate(false);
      setParticipantIds([]);
      setTargetSectionId("");
      setForm({
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        registrationDeadline: "",
        minTeamSize: 1,
        maxTeamSize: 4,
        minProjects: 0,
        minLeetcode: 0,
        minCgpa: "",
        prizeDetails: "",
      });
      void queryClient.invalidateQueries({ queryKey: ["department", "hackathons"] });
      void queryClient.invalidateQueries({ queryKey: ["hackathons"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create hackathon"),
  });

  const hackathons = useMemo(() => {
    const items = data?.data ?? [];
    if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
      return items;
    }
    return items.filter((hackathon) => !departmentId || hackathon.departmentId === departmentId);
  }, [data?.data, departmentId, user?.role]);

  const studentOptions = studentsData?.data ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-semibold tracking-tight">Offline Registration Events</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Organize department, section, or selected-student hackathons while team/project judging flows are offline.
            </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/hackathons" className="text-sm font-medium text-primary hover:underline">
            Browse all events
          </Link>
          <PermissionGate permission="hackathons:create">
            <Button onClick={() => setShowCreate((current) => !current)}>
              {showCreate ? "Close" : "Create event"}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {showCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Hackathon / Event</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-title">Event title</Label>
              <Input
                id="hackathon-create-title"
                placeholder="e.g. Winter Build Sprint"
                value={form.title}
                onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-prize">Prize details</Label>
              <Input
                id="hackathon-create-prize"
                placeholder="Cash, vouchers, internships…"
                value={form.prizeDetails}
                onChange={(e) => setForm((current) => ({ ...current, prizeDetails: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hackathon-create-description">Description</Label>
              <Textarea
                id="hackathon-create-description"
                className="min-h-28"
                placeholder="What participants build, rules, judging, etc."
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-registration-deadline">Registration closes</Label>
              <Input
                id="hackathon-create-registration-deadline"
                type="datetime-local"
                value={form.registrationDeadline}
                onChange={(e) => setForm((current) => ({ ...current, registrationDeadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-start">Starts</Label>
              <Input
                id="hackathon-create-start"
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm((current) => ({ ...current, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-end">Ends</Label>
              <Input
                id="hackathon-create-end"
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm((current) => ({ ...current, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-min-team">Min team size</Label>
              <Input
                id="hackathon-create-min-team"
                type="number"
                min={1}
                value={form.minTeamSize}
                onChange={(e) => setForm((current) => ({ ...current, minTeamSize: Number(e.target.value || 1) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-max-team">Max team size</Label>
              <Input
                id="hackathon-create-max-team"
                type="number"
                min={1}
                value={form.maxTeamSize}
                onChange={(e) => setForm((current) => ({ ...current, maxTeamSize: Number(e.target.value || 1) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-min-projects">Min projects (eligibility)</Label>
              <Input
                id="hackathon-create-min-projects"
                type="number"
                min={0}
                value={form.minProjects}
                onChange={(e) => setForm((current) => ({ ...current, minProjects: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-min-leetcode">Min LeetCode solved</Label>
              <Input
                id="hackathon-create-min-leetcode"
                type="number"
                min={0}
                value={form.minLeetcode}
                onChange={(e) => setForm((current) => ({ ...current, minLeetcode: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-min-cgpa">Min CGPA</Label>
              <Input
                id="hackathon-create-min-cgpa"
                placeholder="Optional"
                value={form.minCgpa}
                onChange={(e) => setForm((current) => ({ ...current, minCgpa: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hackathon-create-section">Audience — section (optional)</Label>
              <Select value={targetSectionId || "none"} onValueChange={(value) => setTargetSectionId(value === "none" ? "" : value)}>
                <SelectTrigger id="hackathon-create-section" className="w-full">
                  <SelectValue placeholder="Whole department / open eligible students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Whole department / open eligible students</SelectItem>
                    {(classesData?.data ?? []).map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {targetSectionId ? (
              <div className="space-y-2 md:col-span-2">
                <p className="text-sm font-medium">Selected students (optional)</p>
                <div className="grid max-h-44 gap-2 overflow-y-auto border border-border p-3 sm:grid-cols-2">
                  {studentOptions.map((entry) => (
                    <label key={entry.student.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={participantIds.includes(entry.student.id)}
                        onChange={() =>
                          setParticipantIds((current) =>
                            current.includes(entry.student.id)
                              ? current.filter((id) => id !== entry.student.id)
                              : [...current, entry.student.id]
                          )
                        }
                      />
                      <span>{entry.student.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="md:col-span-2 flex justify-end">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.title || !form.description || !form.startDate || !form.endDate || !form.registrationDeadline || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Event"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="h-64 animate-pulse" />
          ))
        ) : (
          hackathons.map((hackathon) => {
            const displayStatus = getHackathonDisplayStatus(hackathon);

            return (
            <Card key={hackathon.id} className="overflow-hidden">
              <div className="h-24 bg-linear-to-r from-sky-500/30 via-emerald-500/20 to-amber-500/20" />
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">{hackathon.title}</CardTitle>
                  <Badge variant="outline">{displayStatus}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-2 text-sm text-muted-foreground">{hackathon.description}</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4" />
                    {new Date(hackathon.startDate).toLocaleDateString()} - {new Date(hackathon.endDate).toLocaleDateString()}
                  </div>
                  {hackathon.prizeDetails ? (
                    <div className="flex items-center gap-2">
                      <Trophy className="size-4" />
                      {hackathon.prizeDetails}
                    </div>
                  ) : null}
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
