"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpen, CheckCheck, Code2, GraduationCap, Info, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import type { ApiResponse, Notification } from "@repo/types";
import { api } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader, SectionCard } from "@/components/common/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationsResponse extends ApiResponse<Notification[]> {
  unreadCount: number;
}

function notifIcon(type: string) {
  switch (type) {
    case "ASSIGNMENT_POSTED":
      return <BookOpen className="size-4 text-primary" />;
    case "GRADE_PUBLISHED":
      return <GraduationCap className="size-4 text-accent-foreground" />;
    case "CONTEST_STARTING":
      return <Trophy className="size-4 text-primary" />;
    case "SUBMISSION_JUDGED":
      return <Code2 className="size-4 text-accent-foreground" />;
    case "ENROLLMENT_ADDED":
      return <Users className="size-4 text-primary" />;
    case "COACH_ADVICE_READY":
      return <Trophy className="size-4 text-primary" />;
    default:
      return <Info className="size-4 text-muted-foreground" />;
  }
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationsResponse>("/api/notifications?limit=50"),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/notifications/${id}/read`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.put("/api/notifications/read-all", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="A single notification pattern with clearer unread states, better spacing, and easier action handling."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" className="rounded-xl" onClick={() => markAllReadMutation.mutate()}>
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          ) : null
        }
      />

      <SectionCard className="bg-background p-0">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : notifications.length ? (
          <div className="flex flex-col divide-y divide-border/70">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex flex-col gap-4 p-5 transition-colors sm:flex-row sm:items-start sm:justify-between",
                  !notification.isRead ? "bg-primary/7" : "bg-background"
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                    {notifIcon(notification.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{notification.title}</p>
                      {!notification.isRead ? (
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                          Unread
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{notification.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!notification.isRead ? (
                    <Button
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => markReadMutation.mutate(notification.id)}
                    >
                      Mark read
                    </Button>
                  ) : null}
                  {notification.link ? (
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link href={notification.link}>Open</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Your inbox is quiet"
            description="New course updates, contest changes, and system messages will appear here when they arrive."
            action={
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/dashboard">
                  <Bell className="size-4" />
                  Return to dashboard
                </Link>
              </Button>
            }
          />
        )}
      </SectionCard>
    </PageContainer>
  );
}
