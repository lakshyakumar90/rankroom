import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageErrorBoundary } from "@/components/error-boundary";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* Main content offset by sidebar width (desktop only) */}
      <div className="lg:pl-60 transition-all duration-200">
        <Topbar sidebarWidth={240} />
        <main className="min-h-screen pt-14">
          <div className="p-6">
            <PageErrorBoundary>{children}</PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
