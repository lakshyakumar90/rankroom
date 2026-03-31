"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import {
  buildForbiddenRedirect,
  buildLoginRedirect,
  canAccessRoute,
  isProtectedRoute,
} from "@/lib/route-access";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function FullscreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>Loading your workspace...</span>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuthStore();
  const routeRequiresAuth = isProtectedRoute(pathname);
  const routeAllowed = canAccessRoute(pathname, user?.role);
  const search = searchParams.toString();

  useEffect(() => {
    if (isLoading || !routeRequiresAuth) {
      return;
    }

    if (!user) {
      router.replace(buildLoginRedirect(pathname, search ? `?${search}` : ""));
      return;
    }

    if (!routeAllowed) {
      router.replace(
        buildForbiddenRedirect(user.role, `${pathname}${search ? `?${search}` : ""}`)
      );
    }
  }, [isLoading, pathname, routeAllowed, routeRequiresAuth, router, search, user]);

  if (isLoading) {
    return <FullscreenLoader />;
  }

  if (routeRequiresAuth && (!user || !routeAllowed)) {
    return null;
  }

  return <>{children}</>;
}
