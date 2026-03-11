"use client";

import { create } from "zustand";
import type { Role } from "@repo/types";

interface AuthUser {
  id: string;
  supabaseId: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string | null;
  profile?: {
    totalPoints: number;
    rank?: number | null;
    streak: number;
  } | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser: () => set({ user: null, isLoading: false }),
}));
