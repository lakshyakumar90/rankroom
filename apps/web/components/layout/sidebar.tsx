"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { PermissionKey, Role } from "@repo/types";
import { useAuthStore } from "@/store/auth";
import { hasPermission } from "@/lib/permissions";
import { cn, formatRoleLabel } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Code2,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Megaphone,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  STUDENT: [
    { title: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      title: "Academic",
      items: [
        { href: "/attendance", label: "Attendance", icon: ClipboardList },
        { href: "/grades", label: "Grades", icon: GraduationCap },
        { href: "/assignments", label: "Assignments", icon: BookOpen },
      ],
    },
    {
      title: "Coding",
      items: [
        { href: "/problems", label: "Problems", icon: Code2 },
        { href: "/contests", label: "Contests", icon: Trophy },
        { href: "/leaderboard", label: "Leaderboard", icon: Award },
      ],
    },
    {
      title: "Profile",
      items: [
        { href: "/hackathons", label: "Events", icon: CalendarDays },
        { href: "/profile/edit", label: "Profile", icon: FolderKanban },
        { href: "/notifications", label: "Notifications", icon: Bell },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  TEACHER: [
    { title: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      title: "Teaching",
      items: [
        { href: "/attendance/take", label: "Take Attendance", icon: ClipboardList },
        { href: "/grades", label: "Grades", icon: GraduationCap },
        { href: "/assignments", label: "Assignments", icon: BookOpen },
        { href: "/analytics", label: "Subject Analytics", icon: BarChart3 },
      ],
    },
    {
      title: "Coding",
      items: [
        { href: "/problems", label: "Problems", icon: Code2 },
        { href: "/contests", label: "Contests", icon: Trophy },
        { href: "/contests/create", label: "Create Contest", icon: Trophy, permission: "contests:create" },
      ],
    },
    {
      title: "Engagement",
      items: [
        { href: "/hackathons", label: "Hackathons", icon: CalendarDays },
        { href: "/department/hackathons", label: "Manage Events", icon: Sparkles, permission: "hackathons:create" },
        { href: "/leaderboard", label: "Leaderboard", icon: Award },
        { href: "/notifications", label: "Notifications", icon: Bell },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  CLASS_COORDINATOR: [
    { title: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      title: "Section Ops",
      items: [
        { href: "/attendance", label: "Attendance", icon: ClipboardList },
        { href: "/analytics", label: "Class Analytics", icon: BarChart3 },
        { href: "/leaderboard", label: "Leaderboard", icon: Award },
        { href: "/notifications", label: "Announcements", icon: Megaphone },
      ],
    },
    {
      title: "Instruction",
      items: [
        { href: "/assignments", label: "Assignments", icon: BookOpen },
        { href: "/grades", label: "Grades", icon: GraduationCap },
        { href: "/contests/create", label: "Contests", icon: Trophy },
        { href: "/department/hackathons", label: "Manage Events", icon: Sparkles, permission: "hackathons:create" },
        { href: "/hackathons", label: "Hackathons", icon: CalendarDays },
      ],
    },
  ],
  DEPARTMENT_HEAD: [
    {
      title: "Department",
      items: [
        { href: "/department/overview", label: "Overview", icon: LayoutDashboard },
        { href: "/department/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/department/hackathons", label: "Hackathons", icon: CalendarDays },
      ],
    },
    {
      title: "Programs",
      items: [
        { href: "/assignments", label: "Assignments", icon: BookOpen },
        { href: "/contests", label: "Contests", icon: Trophy },
        { href: "/contests/create", label: "Create Contest", icon: Trophy, permission: "contests:create" },
        { href: "/leaderboard", label: "Leaderboard", icon: Award },
        { href: "/department/hackathons", label: "Manage Events", icon: Sparkles, permission: "hackathons:create" },
        { href: "/hackathons", label: "Hackathons", icon: CalendarDays },
        { href: "/notifications", label: "Announcements", icon: Megaphone },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  ADMIN: [
    {
      title: "Platform",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/departments", label: "Departments", icon: Building2 },
        { href: "/admin/sections", label: "Sections", icon: Shield },
      ],
    },
    {
      title: "Operations",
      items: [
        { href: "/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/admin/classes", label: "Classes", icon: BookOpen },
        { href: "/contests/create", label: "Create Contest", icon: Trophy, permission: "contests:create" },
        { href: "/department/hackathons", label: "Manage Events", icon: Sparkles, permission: "hackathons:create" },
        { href: "/hackathons", label: "Hackathons", icon: CalendarDays },
        { href: "/notifications", label: "Notifications", icon: Bell },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  SUPER_ADMIN: [
    {
      title: "Platform",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/departments", label: "Departments", icon: Building2 },
        { href: "/admin/sections", label: "Sections", icon: Shield },
      ],
    },
    {
      title: "Operations",
      items: [
        { href: "/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/admin/classes", label: "Classes", icon: BookOpen },
        { href: "/contests/create", label: "Create Contest", icon: Trophy, permission: "contests:create" },
        { href: "/department/hackathons", label: "Manage Events", icon: Sparkles, permission: "hackathons:create" },
        { href: "/hackathons", label: "Hackathons", icon: CalendarDays },
        { href: "/notifications", label: "Notifications", icon: Bell },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
};

const ROLE_BADGE_VARIANT: Record<Role, "secondary" | "outline" | "default"> = {
  STUDENT: "secondary",
  TEACHER: "outline",
  CLASS_COORDINATOR: "outline",
  DEPARTMENT_HEAD: "outline",
  ADMIN: "default",
  SUPER_ADMIN: "default",
};

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  if (!user) return null;

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <div className="flex flex-col gap-5">
        {(NAV_BY_ROLE[user.role] ?? []).map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || hasPermission(user.role, item.permission)
          );

          if (!visibleItems.length) return null;

          return (
            <div key={group.title} className="flex flex-col gap-2">
              {!collapsed ? (
                <p className="px-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {group.title}
                </p>
              ) : null}
              <div className="flex flex-col gap-1">
                {visibleItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function SidebarContent({
  collapsed,
  onCollapsedChange,
  onNavigate,
}: {
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: () => void;
}) {
  const user = useAuthStore((state) => state.user);

  if (!user) return null;

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center justify-between border-b border-border p-4", collapsed && "px-3")}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold tracking-tight">RankRoom</p>
              <p className="text-xs text-muted-foreground">CRM for academic ops</p>
            </div>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <div className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </div>
          </div>
        )}
        {onCollapsedChange ? (
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        ) : null}
      </div>

      <div className={cn("border-b border-border p-4", collapsed && "px-3")}>
        <div className={cn("surface-inset flex items-center gap-3 p-3", collapsed && "justify-center")}>
          <Avatar src={user.avatar} name={user.name} />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <Badge variant={ROLE_BADGE_VARIANT[user.role]} className="mt-3 px-2.5 py-0.5">
                {formatRoleLabel(user.role)}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>

      <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />
    </div>
  );
}

export function Sidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="size-4" />
      </Button>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar overlay"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[min(20rem,100vw)] overflow-hidden border-r border-border bg-card lg:hidden">
            <div className="flex items-center justify-end border-b border-border/70 p-3">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close sidebar">
                <X className="size-4" />
              </Button>
            </div>
            <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-border bg-card lg:block",
          collapsed ? "w-24" : "w-72"
        )}
      >
        <SidebarContent collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
      </aside>
    </>
  );
}
