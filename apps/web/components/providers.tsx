"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import type { ApiResponse } from "@repo/types";

function AuthInitializer() {
  const { setUser, clearUser } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    // Load current user
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const data = await api.get<ApiResponse<{ id: string; supabaseId: string; email: string; name: string; role: string; avatar?: string | null; profile?: { totalPoints: number; rank?: number | null; streak: number } | null }>>("/api/auth/me");
          if (data.data) setUser(data.data as Parameters<typeof setUser>[0]);
        } catch {
          clearUser();
        }
      } else {
        clearUser();
      }
    }

    loadUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        clearUser();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, clearUser]);

  return null;
}

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
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthInitializer />
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
