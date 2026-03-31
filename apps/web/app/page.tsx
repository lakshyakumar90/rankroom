"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getDefaultRouteForRole } from "@/lib/route-access";

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      router.replace(user ? getDefaultRouteForRole(user.role) : "/login");
    }
  }, [isLoading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>Checking your session...</span>
      </div>
    </div>
  );
}
