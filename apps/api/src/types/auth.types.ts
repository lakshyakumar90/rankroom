import type { Role } from "@repo/types";

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

export interface LogoutRequest {
  // No body - token from Authorization header
}

// ============================================================================
// RESPONSE TYPES
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
  createdAt: Date;
  updatedAt: Date;
  profile: {
    id: string;
    userId: string;
    handle: string | null;
    bio: string | null;
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
  studentProfile?: {
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
    lastSyncedAt: Date | null;
    bio: string | null;
    resumeUrl: string | null;
    resumeFilename: string | null;
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
  scope: {
    departmentIds: string[];
    sectionIds: string[];
    teachingAssignments: Array<{
      teacherId: string;
      subjectId: string;
      sectionId: string;
    }>;
    primaryDepartmentId?: string | null;
    primarySectionId?: string | null;
  };
}

export interface LoginResponse {
  success: true;
  data: {
    user: AuthUser;
    session: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      expires_at: number;
    };
  };
}

export interface SignupResponse {
  success: true;
  data: {
    user: AuthUser;
    session: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      expires_at: number;
    } | null; // null if email confirmation required
    emailConfirmationRequired: boolean;
  };
}

export interface MeResponse {
  success: true;
  data: AuthUser;
}

export interface LogoutResponse {
  success: true;
}

export interface AuthErrorResponse {
  success: false;
  error: string;
  message: string;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

export interface SupabaseAuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: "bearer";
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
}
