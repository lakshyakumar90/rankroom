"use client";

import { useTheme } from "next-themes";
import { useAuthStore } from "@/store/auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Sun, Moon, Bell, LogOut } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiResponse } from "@repo/types";

interface NotifCountResponse extends ApiResponse<unknown> {
  unreadCount?: number;
}

export function Topbar({ sidebarWidth = 240 }: { sidebarWidth?: number }) {
  const { theme, setTheme } = useTheme();
  const { user, clearUser } = useAuthStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: () => api.get<NotifCountResponse>("/api/notifications?limit=1"),
    refetchInterval: 60_000,
    enabled: !!user,
  });

  const unreadCount = notifData?.unreadCount ?? 0;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearUser();
    router.push("/login");
  }

  return (
    <header
      className="fixed right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 left-0 lg:left-[240px]"
    >
      {/* Left: Breadcrumb area (empty for now, pages can use portal) */}
      <div className="flex-1" />

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <Link href="/notifications" className="relative">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </Link>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-md p-1 hover:bg-accent transition-colors"
          >
            <Avatar src={user?.avatar} name={user?.name} size="sm" />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-none">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
              <Link
                href={`/profile/${user?.name}`}
                className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
                onClick={() => setMenuOpen(false)}
              >
                <Avatar src={user?.avatar} name={user?.name} size="sm" />
                <span>View Profile</span>
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </Link>
              <hr className="my-1 border-border" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
