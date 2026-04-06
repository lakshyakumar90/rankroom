"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiResponse } from "@repo/types";

interface UserSettings {
  notificationsEnabled: boolean;
  emailDigest: boolean;
  contestReminders: boolean;
  hackathonReminders: boolean;
  assignmentReminders: boolean;
  attendanceAlerts: boolean;
}

const PREFERENCE_LABELS: Array<{ key: keyof UserSettings; label: string; description: string }> = [
  { key: "notificationsEnabled", label: "In-app notifications", description: "Receive notifications within the app" },
  { key: "emailDigest", label: "Email digest", description: "Receive a daily summary email" },
  { key: "contestReminders", label: "Contest reminders", description: "Get notified before contest start time" },
  { key: "hackathonReminders", label: "Hackathon reminders", description: "Get notified about hackathon deadlines" },
  { key: "assignmentReminders", label: "Assignment reminders", description: "Get reminded before assignment due dates" },
  { key: "attendanceAlerts", label: "Attendance alerts", description: "Get alerted when attendance falls below threshold" },
];

export function NotificationSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user-settings"],
    queryFn: () => api.get<ApiResponse<UserSettings>>("/api/settings"),
  });

  const [prefs, setPrefs] = useState<UserSettings | null>(null);
  const settings = prefs ?? data?.data ?? null;

  const mutation = useMutation({
    mutationFn: (updates: Partial<UserSettings>) => api.patch("/api/settings", updates),
    onSuccess: () => {
      toast.success("Notification preferences saved");
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-3xl gap-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Notification preferences</CardTitle>
          <CardDescription>Control which notifications you receive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {PREFERENCE_LABELS.map(({ key, label, description }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3 hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={settings?.[key] ?? false}
                onCheckedChange={(v) => {
                  setPrefs((prev) => ({ ...(prev ?? settings ?? ({} as UserSettings)), [key]: v }));
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => settings && mutation.mutate(settings)}
          disabled={mutation.isPending || !prefs}
        >
          {mutation.isPending ? "Saving..." : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
