"use client";

import { create } from "zustand";
import type { AuthScope, Role } from "@repo/types";

// ============================================================================
// AUTH USER TYPE - matches /auth/me response structure
// ============================================================================

export interface AuthUser {
  id: string;
  supabaseId: string;
  email: string;
  name: string;
  role: Role;
  avatar: string | null;
  githubUsername: string | null;
  isVerified: boolean;
  scope: AuthScope;
  profile: {
    id: string;
    userId: string;
    handle: string | null;
    bio: string | null;
    phoneNumber: string | null;
    skills: string[];
    socialLinks: Record<string, string> | null;
    college: string | null;
    batch: string | null;
    department: string | null;
    isPublic: boolean;
    totalPoints: number;
    rank: number | null;
    streak: number;
  } | null;
  studentProfile: {
    id: string;
    userId: string;
    leetcodeUsername: string | null;
    githubUsername: string | null;
    codechefUsername: string | null;
    codeforcesUsername: string | null;
    hackerrankUsername: string | null;
    leetcodeSolved: number;
    leetcodeEasy: number;
    leetcodeMedium: number;
    leetcodeHard: number;
    leetcodeAcceptanceRate: number | null;
    githubContributions: number;
    githubTopLanguages: Array<{ language: string; count: number }> | null;
    codechefRating: number | null;
    codechefMaxRating: number | null;
    codechefStars: number | null;
    codeforcesRating: number | null;
    codeforcesMaxRating: number | null;
    codeforcesRank: string | null;
    cgpa: number | null;
    activityHeatmap: Record<string, number>;
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: Date | null;
    lastSyncedAt: Date | null;
    bio: string | null;
    resumeUrl: string | null;
    resumeFilename: string | null;
    avatarPath: string | null;
  } | null;
  enrollments?: Array<{
    id: string;
    sectionId: string;
    section: {
      id: string;
      name: string;
      code: string;
      departmentId: string;
      academicYear: string;
      department: {
        id: string;
        name: string;
        code: string;
      };
    };
  }>;
  teachingAssignments?: Array<{
    id: string;
    teacherId: string;
    subjectId: string;
    sectionId: string;
    section: {
      id: string;
      name: string;
      departmentId: string;
      department: {
        id: string;
        name: string;
        code: string;
      };
    };
    subject: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

// ============================================================================
// AUTH STATE INTERFACE
// ============================================================================

export interface AuthState {
  /** Current authenticated user - ONLY set from /auth/me response */
  user: AuthUser | null;
  
  /** Loading state - true during auth checks, false when complete */
  isLoading: boolean;
  
  /** Set user and mark loading as complete (atomic operation) */
  setUser: (user: AuthUser | null) => void;
  
  /** Set loading state (use sparingly - prefer setUser or clearUser) */
  setLoading: (loading: boolean) => void;
  
  /** Clear all auth state (logout) */
  clearUser: () => void;
}

// ============================================================================
// ZUSTAND STORE - Single source of truth for auth state
// ============================================================================

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  
  // Atomic operation: set user and complete loading
  setUser: (user) => set({ user, isLoading: false }),
  
  // Set loading state
  setLoading: (isLoading) => set({ isLoading }),
  
  // Atomic operation: clear user and complete loading
  clearUser: () => set({ user: null, isLoading: false }),
}));
