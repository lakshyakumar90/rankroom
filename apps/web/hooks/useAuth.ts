"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { logout } from "@/lib/auth";

/**
 * Convenience hook for accessing the current auth state and actions.
 *
 * Usage:
 *   const { user, isLoading, isAuthenticated, signOut } = useAuth();
 */
export function useAuth() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  async function signOut() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signOut,
  };
}
