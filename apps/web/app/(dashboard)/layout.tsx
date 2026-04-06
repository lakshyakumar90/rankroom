"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageErrorBoundary } from "@/components/error-boundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isProblemWorkspace = pathname.startsWith("/problems/");

  return (
    <Suspense fallback={null}>
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          {!isProblemWorkspace ? (
            <div className="pointer-events-none fixed inset-0 -z-10">
              <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,var(--color-primary),transparent_68%)] opacity-10" />
              <div className="absolute left-0 top-28 size-72 rounded-full bg-primary/6 blur-3xl" />
              <div className="absolute bottom-0 right-0 size-80 rounded-full bg-accent/40 blur-3xl" />
            </div>
          ) : null}
          {!isProblemWorkspace ? (
            <Sidebar
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
            />
          ) : null}
          <div
            className={
              isProblemWorkspace
                ? "transition-all duration-200"
                : sidebarCollapsed
                ? "transition-all duration-200 lg:pl-24"
                : "transition-all duration-200 lg:pl-72"
            }
          >
            {!isProblemWorkspace ? <Topbar sidebarCollapsed={sidebarCollapsed} /> : null}
            <main className={isProblemWorkspace ? "h-screen" : "min-h-screen pt-16"}>
              <div
                className={
                  isProblemWorkspace
                    ? "h-full w-full"
                    : "mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6"
                }
              >
                <PageErrorBoundary>{children}</PageErrorBoundary>
              </div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    </Suspense>
  );
}
