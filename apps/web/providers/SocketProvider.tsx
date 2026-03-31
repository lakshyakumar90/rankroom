"use client";

import { useEffect, useEffectEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Notification, SubmissionResult } from "@repo/types";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth";
import { useNotificationStore } from "@/store/notifications";

function verdictTone(verdict: string) {
  return verdict === "AC" ? "success" : "error";
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const prependNotification = useNotificationStore((state) => state.prependNotification);
  const clearNotifications = useNotificationStore((state) => state.clear);

  const handleNotification = useEffectEvent((notification: Notification) => {
    prependNotification(notification);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });

    toast(notification.title, {
      description: notification.message,
      action: notification.link
        ? {
            label: "Open",
            onClick: () => {
              window.location.href = notification.link!;
            },
          }
        : undefined,
    });
  });

  const handleLeaderboardUpdated = useEffectEvent((payload: { sectionId: string }) => {
    void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    toast("Leaderboard updated", {
      description: "Fresh scores are available for your section leaderboard.",
      action: {
        label: "View",
        onClick: () => {
          window.location.href = `/leaderboard/section/${payload.sectionId}`;
        },
      },
    });
  });

  const handleSubmissionResult = useEffectEvent((payload: SubmissionResult) => {
    const variant = verdictTone(payload.verdict);
    toast[variant](
      payload.verdict === "AC" ? "Solution accepted" : `Submission result: ${payload.verdict}`,
      {
        description: `Runtime ${payload.runtime ?? 0}ms • Memory ${payload.memory ?? 0}KB`,
      }
    );

    void queryClient.invalidateQueries({ queryKey: ["submissions"] });
    void queryClient.invalidateQueries({ queryKey: ["problems"] });
  });

  useEffect(() => {
    const socket = getSocket();

    if (!user) {
      clearNotifications();
      socket.disconnect();
      return;
    }

    socket.connect();
    socket.emit("user:join", { userId: user.id });

    if (user.scope.primarySectionId) {
      socket.emit("section:join", { sectionId: user.scope.primarySectionId });
    }

    if (user.scope.primaryDepartmentId) {
      socket.emit("department:join", { departmentId: user.scope.primaryDepartmentId });
    }

    socket.on("notification:new", handleNotification);
    socket.on("leaderboard:updated", handleLeaderboardUpdated);
    socket.on("submission:result", handleSubmissionResult);

    return () => {
      socket.off("notification:new", handleNotification);
      socket.off("leaderboard:updated", handleLeaderboardUpdated);
      socket.off("submission:result", handleSubmissionResult);
    };
  }, [
    clearNotifications,
    handleLeaderboardUpdated,
    handleNotification,
    handleSubmissionResult,
    user,
  ]);

  return <>{children}</>;
}
