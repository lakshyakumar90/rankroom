"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiResponse, type Notification } from "@repo/types";
import { formatRelativeTime } from "@/lib/utils";
import { Bell, CheckCheck, Trophy, BookOpen, GraduationCap, Code2, Users, Info } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

const notifIcon = (type: string) => {
  switch (type) {
    case "ASSIGNMENT_POSTED": return <BookOpen className="h-4 w-4 text-amber-500" />;
    case "GRADE_PUBLISHED": return <GraduationCap className="h-4 w-4 text-blue-500" />;
    case "CONTEST_STARTING": return <Trophy className="h-4 w-4 text-violet-500" />;
    case "SUBMISSION_JUDGED": return <Code2 className="h-4 w-4 text-emerald-500" />;
    case "ENROLLMENT_ADDED": return <Users className="h-4 w-4 text-pink-500" />;
    default: return <Info className="h-4 w-4 text-muted-foreground" />;
  }
};

interface NotificationsResponse extends ApiResponse<Notification[]> {
  unreadCount: number;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationsResponse>("/api/notifications?limit=50"),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch("/api/notifications/read-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-3 p-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1"><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-3 w-32" /></div>
              </CardContent>
            </Card>
          ))
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <Card
              key={notif.id}
              className={cn("cursor-pointer hover:border-primary/20 transition-colors", !notif.isRead && "border-primary/30 bg-primary/5")}
              onClick={() => {
                if (!notif.isRead) markReadMutation.mutate(notif.id);
              }}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  {notifIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{notif.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(notif.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                  {notif.link && (
                    <Link href={notif.link} className="text-xs text-primary hover:underline mt-1 inline-block">
                      View →
                    </Link>
                  )}
                </div>
                {!notif.isRead && (
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
