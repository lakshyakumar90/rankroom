"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  BookOpen,
  Code2,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/problems", label: "Problems", icon: Code2 },
  { href: "/contests", label: "Contests", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: Users },
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/assignments", label: "Assignments", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function ProfilePageHeader({ username }: { username?: string }) {
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLoggedIn = !!user;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearUser();
    router.push("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
              <ArrowLeft className="size-5" />
            </Button>
            <div className="flex flex-col">
              <span className="text-base font-semibold">
                {username ? `@${username}` : "Profile"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-auto px-2 py-1.5">
                    <Avatar src={user?.avatar} name={user?.name} size="sm" />
                    <div className="hidden text-left ltr:ml-2 rtl:mr-2 sm:block">
                      <p className="text-sm font-medium leading-none">
                        {user?.name?.split(" ")[0]}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Account
                      </p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(
                        `/u/${user?.profile?.handle ?? user?.name?.toLowerCase().replace(/\s+/g, "-")}`,
                      )
                    }
                  >
                    View my profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/settings")}
                  >
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Sign up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-[280px] overflow-hidden border-l border-border bg-background shadow-xl lg:hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="font-semibold">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {isLoggedIn &&
                NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                ))}
              {!isLoggedIn && (
                <div className="flex flex-col gap-2">
                  <Button variant="ghost" asChild>
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      Log in
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/register" onClick={() => setMobileOpen(false)}>
                      Sign up
                    </Link>
                  </Button>
                </div>
              )}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
