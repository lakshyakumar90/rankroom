"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { Suspense, useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { SocketProvider } from "@/providers/SocketProvider";
import { toast } from "sonner";
import { hydrateUser, signOutLocalAndClearStore } from "@/lib/auth";
import {
  buildForbiddenRedirect,
  buildLoginRedirect,
  canAccessRoute,
  getDefaultRouteForRole,
  isAuthRoute,
  isProtectedRoute,
} from "@/lib/route-access";
import type { AuthUser } from "@/store/auth";

function AuthInitializer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading, clearUser, setLoading } = useAuthStore();
  const isInitializingRef = useRef(true);

  useEffect(() => {
    const supabase = createClient();
    isInitializingRef.current = true;

    async function restoreSession() {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          clearUser();
          return;
        }

        const hydratedUser = await hydrateUser();
        if (hydratedUser) return;

        await signOutLocalAndClearStore();
      } finally {
        isInitializingRef.current = false;
      }
    }

    async function refreshAuthUser() {
      const hydratedUser = await hydrateUser();
      if (!hydratedUser) {
        await signOutLocalAndClearStore();
      }
    }

    void restoreSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isInitializingRef.current) {
        return;
      }

      if (event === "SIGNED_OUT" || !session) {
        clearUser();
        return;
      }

      if (event === "SIGNED_IN") {
        if (!useAuthStore.getState().user) {
          await refreshAuthUser();
        }
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        await refreshAuthUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [clearUser, setLoading]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const currentSearch = searchParams.toString();

    if (user && isAuthRoute(pathname)) {
      router.replace(getDefaultRouteForRole(user.role));
      return;
    }

    if (!user && isProtectedRoute(pathname)) {
      router.replace(buildLoginRedirect(pathname, currentSearch ? `?${currentSearch}` : ""));
      return;
    }

    if (user && !canAccessRoute(pathname, user.role)) {
      router.replace(
        buildForbiddenRedirect(
          user.role,
          `${pathname}${currentSearch ? `?${currentSearch}` : ""}`
        )
      );
    }
  }, [isLoading, pathname, router, searchParams, user]);

  useEffect(() => {
    const deniedFrom = searchParams.get("deniedFrom");
    if (!deniedFrom) {
      return;
    }

    toast.error("You do not have access to that page.");

    const next = new URLSearchParams(searchParams.toString());
    next.delete("deniedFrom");
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}

import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <AuthInitializer />
        </Suspense>
        <SocketProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </SocketProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
