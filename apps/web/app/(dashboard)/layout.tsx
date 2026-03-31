"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageErrorBoundary } from "@/components/error-boundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <Suspense fallback={null}>
      <ProtectedRoute>
        <div className="min-h-screen bg-transparent">
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
          <div
            className={
              sidebarCollapsed
                ? "transition-all duration-200 lg:pl-24"
                : "transition-all duration-200 lg:pl-72"
            }
          >
            <Topbar sidebarCollapsed={sidebarCollapsed} />
            <main className="min-h-screen pt-16">
              <div className="w-full p-4 sm:p-6">
                <PageErrorBoundary>{children}</PageErrorBoundary>
              </div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    </Suspense>
  );
}
