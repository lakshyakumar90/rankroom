import { createClient } from "./supabase/client";
import { useAuthStore } from "@/store/auth";
import type { AuthUser } from "@/store/auth";

// ============================================================================
// AUTH TOKEN UTILITY
// ============================================================================

/**
 * Get the current JWT access token from Supabase session
 * @returns access_token string or null if no session
 */
export async function getAuthToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ============================================================================
// HYDRATE USER FROM /auth/me
// ============================================================================

/**
 * Hydrate user state by calling /auth/me endpoint
 * This is the ONLY way to populate user state
 * @returns AuthUser if successful, null otherwise
 */
export async function hydrateUser(): Promise<AuthUser | null> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return null;
    }

    const meResponse = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (meResponse.status === 404) {
      const syncResponse = await fetch("/api/auth/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!syncResponse.ok) {
        return null;
      }

      const retryResponse = await fetch("/api/auth/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!retryResponse.ok) {
        return null;
      }

      const retryResult = await retryResponse.json();
      if (!retryResult.success || !retryResult.data) {
        return null;
      }

      const user: AuthUser = retryResult.data;
      useAuthStore.getState().setUser(user);
      return user;
    }

    if (!meResponse.ok) {
      return null;
    }

    const result = await meResponse.json();
    
    if (!result.success || !result.data) {
      return null;
    }

    const user: AuthUser = result.data;
    
    // Update store with full user data
    useAuthStore.getState().setUser(user);
    
    return user;
  } catch (error) {
    console.error("Error hydrating user:", error);
    return null;
  }
}

// ============================================================================
// CLEAR AUTH STATE
// ============================================================================

/**
 * Clear all auth state from the store
 * Does NOT call logout endpoint or clear Supabase session
 * Use logout() for full logout flow
 */
export function clearAuth(): void {
  useAuthStore.getState().clearUser();
}

// ============================================================================
// LOGOUT
// ============================================================================

/**
 * Complete logout flow:
 * 1. Call POST /api/auth/logout to revoke session server-side
 * 2. Clear local Supabase session (removes cookies)
 * 3. Clear Zustand store
 * 
 * The Next.js middleware will then redirect any protected route access to /login.
 */
export async function logout(): Promise<void> {
  const supabase = createClient();

  // Attempt server-side revocation — ignore failures so local logout always works
  try {
    const token = await getAuthToken();
    if (token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    // Intentionally swallowed — local logout still proceeds
    console.error("Server logout error:", error);
  }

  // Clear local Supabase session (removes cookies)
  await supabase.auth.signOut();

  // Clear Zustand store
  clearAuth();
}
