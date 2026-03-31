"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApiResponse } from "@repo/types";
import { CalendarDays, Trophy, Users } from "lucide-react";
import { toast } from "sonner";

interface HackathonDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  prizeDetails?: string | null;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  minTeamSize: number;
  maxTeamSize: number;
  department?: { id: string; name: string; code: string } | null;
  eligibility?: { isEligible: boolean; reason: string };
  registrations?: Array<{ id: string; student: { id: string; name: string } }>;
}

export default function HackathonDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const { data, isLoading } = useQuery({
    queryKey: ["hackathon", params.id],
    queryFn: () => api.get<ApiResponse<HackathonDetail>>(`/api/hackathons/${params.id}`),
    enabled: !!params.id,
  });

  const registerMutation = useMutation({
    mutationFn: () => api.post(`/api/hackathons/${params.id}/register`, {}),
    onSuccess: () => {
      toast.success("Registered successfully");
      void queryClient.invalidateQueries({ queryKey: ["hackathon", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["hackathons"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to register"),
  });

  const hackathon = data?.data;

  if (isLoading || !hackathon) {
    return <div className="p-6 text-sm text-muted-foreground">Loading hackathon...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{hackathon.status}</Badge>
          <Badge variant="secondary">{hackathon.department?.name ?? "Global / Open"}</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{hackathon.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{hackathon.description}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Registration closes {new Date(hackathon.registrationDeadline).toLocaleString()}
            </div>
            <div>Starts {new Date(hackathon.startDate).toLocaleString()}</div>
            <div>Ends {new Date(hackathon.endDate).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team size {hackathon.minTeamSize} - {hackathon.maxTeamSize}
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              {hackathon.prizeDetails ?? "Prize details will be shared by organizers"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eligibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.role === "STUDENT" ? (
              <div
                className={`border px-3 py-3 text-sm ${
                  hackathon.eligibility?.isEligible
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                }`}
              >
                {hackathon.eligibility?.reason ?? "Eligibility unavailable"}
              </div>
            ) : (
              <div className="border border-border px-3 py-3 text-sm text-muted-foreground">
                Organizer and elevated-role access.
              </div>
            )}
            {user?.role === "STUDENT" ? (
              <Button
                className="w-full"
                onClick={() => registerMutation.mutate()}
                disabled={!hackathon.eligibility?.isEligible || registerMutation.isPending}
              >
                {registerMutation.isPending ? "Registering..." : "Register"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered participants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(hackathon.registrations ?? []).length > 0 ? (
            (hackathon.registrations ?? []).map((registration) => (
              <div key={registration.id} className="flex items-center justify-between border border-border px-4 py-3">
                <p className="font-medium">{registration.student.name}</p>
                <Badge variant="outline">Registered</Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No participants registered yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
