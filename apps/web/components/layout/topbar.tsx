"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Bell,
  BookOpen,
  CheckCheck,
  Code2,
  GraduationCap,
  LogOut,
  Monitor,
  Moon,
  Search,
  Sparkles,
  Sun,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import type { ApiResponse, Notification } from "@repo/types";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { useNotificationStore } from "@/store/notifications";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn, formatRelativeTime, formatRoleLabel } from "@/lib/utils";

interface NotificationsResponse extends ApiResponse<Notification[]> {
  unreadCount?: number;
}

interface SearchItem {
  id: string;
  type: "problem" | "contest" | "assignment" | "user";
  title: string;
  subtitle: string;
  href: string;
}

function notificationIcon(type: Notification["type"]) {
  switch (type) {
    case "ASSIGNMENT_POSTED":
    case "ASSIGNMENT_GRADED":
      return <BookOpen className="size-4 text-primary" />;
    case "CONTEST_CREATED":
    case "CONTEST_STARTING_SOON":
    case "CONTEST_ENDED":
      return <Trophy className="size-4 text-accent-foreground" />;
    case "SUBMISSION_ACCEPTED":
      return <Code2 className="size-4 text-primary" />;
    case "LEADERBOARD_UPDATED":
      return <Sparkles className="size-4 text-accent-foreground" />;
    case "ATTENDANCE_LOW":
      return <GraduationCap className="size-4 text-destructive" />;
    default:
      return <Bell className="size-4 text-muted-foreground" />;
  }
}

export function Topbar({ sidebarCollapsed = false }: { sidebarCollapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, clearUser } = useAuthStore();
  const { items, unreadCount, setNotifications, markRead, markAllRead } = useNotificationStore();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", "topbar"],
    queryFn: () => api.get<NotificationsResponse>("/api/notifications?limit=8"),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { data: searchData } = useQuery({
    queryKey: ["global-search", search],
    queryFn: () => api.get<ApiResponse<SearchItem[]>>(`/api/search?q=${encodeURIComponent(search)}`),
    enabled: !!user && search.trim().length >= 2,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (data?.data) setNotifications(data.data, data.unreadCount);
  }, [data, setNotifications]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/notifications/${id}/read`, {}),
    onSuccess: (_result, id) => {
      markRead(id);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.put("/api/notifications/read-all", {}),
    onSuccess: () => {
      markAllRead();
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const profileHref = useMemo(() => {
    if (!user?.profile?.handle) return "/profile/edit";
    return `/u/${user.profile.handle}`;
  }, [user?.profile?.handle]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearUser();
    router.push("/login");
  }

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-20",
        sidebarCollapsed ? "lg:left-24" : "lg:left-72"
      )}
    >
      <div className="flex h-16 w-full items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            {formatRoleLabel(user?.role)}
          </p>
          <p className="truncate text-sm font-semibold sm:text-base">
            {user ? `Welcome back, ${user.name.split(" ")[0]}` : "RankRoom"}
          </p>
        </div>

        <div className="hidden flex-1 xl:block">
          <div className="relative ml-auto max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search"
              className="h-10 bg-background pl-9"
              placeholder="Search pages, people, or problems"
              value={search}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => setSearch(event.target.value)}
            />
            {searchOpen && search.trim().length >= 2 ? (
              <div className="absolute inset-x-0 top-12 border border-border bg-card shadow-sm">
                {(searchData?.data ?? []).length > 0 ? (
                  (searchData?.data ?? []).map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 border-b border-border px-3 py-3 text-left last:border-b-0 hover:bg-muted"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearch("");
                        router.push(result.href);
                      }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{result.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                        {result.type}
                      </Badge>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No results found.</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Change theme">
                {theme === "dark" ? <Moon className="size-4" /> : theme === "light" ? <Sun className="size-4" /> : <Monitor className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="size-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="size-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="size-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
                <Bell className="size-4" />
                {unreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
                {unreadCount > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    onClick={() => markAllReadMutation.mutate()}
                  >
                    <CheckCheck className="size-3.5" />
                    Mark all read
                  </Button>
                ) : null}
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-96 overflow-y-auto p-2">
                {items.length ? (
                  items.slice(0, 8).map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="items-start gap-3 px-3 py-3"
                      onClick={() => {
                        if (!notification.isRead) markReadMutation.mutate(notification.id);
                        if (notification.link) router.push(notification.link);
                      }}
                    >
                      <div className="mt-0.5">{notificationIcon(notification.type)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-medium">{notification.title}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {notification.message}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No notifications yet.
                  </div>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="px-4 py-3">
                <Link href="/notifications" className="text-sm font-medium text-primary">
                  View all notifications
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto px-2 py-1.5">
                <Avatar src={user?.avatar} name={user?.name} size="sm" />
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatRoleLabel(user?.role)}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2 py-2">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {user?.role ? (
                  <Badge variant="secondary" className="mt-2 rounded-full px-2.5 py-0.5">
                    {formatRoleLabel(user.role)}
                  </Badge>
                ) : null}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(profileHref)}>View profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/profile/edit")}>Edit profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout}>
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
