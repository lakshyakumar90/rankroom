"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { Role } from "@repo/types";
import {
  LayoutDashboard,
  ClipboardList,
  GraduationCap,
  BookOpen,
  Code2,
  Trophy,
  BarChart3,
  Settings,
  Users,
  Building2,
  School,
  Award,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/assignments", label: "Assignments", icon: BookOpen },
  { href: "/problems", label: "Problems", icon: Code2 },
  { href: "/contests", label: "Contests", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: Award },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  // Admin / Teacher
  { href: "/admin/users", label: "Users", icon: Users, roles: [Role.ADMIN] },
  { href: "/admin/departments", label: "Departments", icon: Building2, roles: [Role.ADMIN] },
  { href: "/admin/classes", label: "Classes", icon: School, roles: [Role.ADMIN, Role.TEACHER] },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarNavProps {
  collapsed: boolean;
  onNavClick?: () => void;
}

function SidebarNav({ collapsed, onNavClick }: SidebarNavProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  return (
    <nav className="flex-1 overflow-y-auto py-4 no-scrollbar">
      <ul className="space-y-0.5 px-2">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "flex h-14 items-center border-b border-border px-4",
        collapsed && "justify-center"
      )}
    >
      {!collapsed ? (
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Code2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">RankRoom</span>
        </Link>
      ) : (
        <Link href="/dashboard">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Code2 className="h-4 w-4 text-primary-foreground" />
          </div>
        </Link>
      )}
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Mobile hamburger button (visible on small screens) ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>

        <Logo collapsed={false} />
        <SidebarNav collapsed={false} onNavClick={() => setMobileOpen(false)} />
      </aside>

      {/* ── Desktop fixed sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-background transition-all duration-200 lg:flex",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <Logo collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />

        {/* Collapse toggle */}
        <div className="border-t border-border p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
