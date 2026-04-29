import { Router, type Router as ExpressRouter } from "express";
import { Prisma, prisma } from "@repo/database";
import { supabase } from "../lib/supabase";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { updateProfileSchema } from "@repo/validators";
import { Role, type Role as RoleType } from "@repo/types";
import { ensureUniqueHandle } from "../lib/handles";
import { syncSupabaseUserToDatabase } from "../lib/auth-sync";
import { buildUserScope } from "../services/scope.service";
import { logActivity } from "../lib/activity";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type {
  MeResponse,
  LogoutResponse,
  AuthUser,
} from "../types/auth.types";

const router: ExpressRouter = Router();
const passwordAuthClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const fullUserInclude = {
  profile: true,
  studentProfile: true,
  enrollments: {
    include: {
      section: {
        include: {
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
    take: 1,
  },
  teachingAssignments: {
    include: {
      section: {
        include: {
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      },
      subject: {
        select: { id: true, name: true, code: true },
      },
    },
  },
} as const;

const safeUserInclude = {
  profile: true,
} as const;

function isMissingColumnError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022";
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

function isSchemaMismatchError(error: unknown): boolean {
  return isMissingColumnError(error) || isMissingTableError(error);
}

async function findAuthUserById(id: string) {
  try {
    return await prisma.user.findUnique({
      where: { id },
      include: fullUserInclude,
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    console.error("Falling back to safe user include due to schema mismatch", {
      id,
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
    });
    return prisma.user.findUnique({
      where: { id },
      include: safeUserInclude,
    });
  }
}

function parseSyncRole(value: unknown): RoleType | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || !Object.values(Role).includes(value as Role)) {
    throw new AppError("Invalid role", 400);
  }

  // Public signup flow only allows student role.
  if (value !== Role.STUDENT) {
    throw new AppError("Invalid role", 400);
  }

  return value as RoleType;
}

async function buildAuthUserResponse(userId: string) {
  const fullUser = await findAuthUserById(userId);
  if (!fullUser) {
    throw new AppError("Failed to load user", 500);
  }

  if (!fullUser.isActive) {
    throw new AppError("Account is deactivated", 401);
  }

  const scope = await buildUserScope(fullUser.id, fullUser.role as RoleType);
  return { ...fullUser, role: fullUser.role as RoleType, scope } as AuthUser;
}

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const { data, error } = await passwordAuthClient.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new AppError("Invalid email or password", 401);
    }

    const syncedUser = await syncSupabaseUserToDatabase(data.user);
    const authUser = await buildAuthUserResponse(syncedUser.id);
    void logActivity(syncedUser.id, "auth.login");

    res.json({
      success: true,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: authUser,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const { data, error } = await passwordAuthClient.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      throw new AppError("Invalid refresh token", 401);
    }

    const syncedUser = await syncSupabaseUserToDatabase(data.user);
    const authUser = await buildAuthUserResponse(syncedUser.id);

    res.json({
      success: true,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: authUser,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/auth/me
// Returns current authenticated user's full profile (SINGLE SOURCE OF TRUTH)
// ============================================================================
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await findAuthUserById(req.user!.id);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (!user.isActive) {
      throw new AppError("Account is deactivated", 401);
    }

    // Always compute scope from fresh DB state.
    const scope = await buildUserScope(user.id, user.role as RoleType);

    const authUser: AuthUser = {
      ...user,
      role: user.role as RoleType,
      scope,
    } as AuthUser;

    const response: MeResponse = {
      success: true,
      data: authUser,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/auth/sync
// Syncs Supabase-authenticated user into DB and returns full auth user state
// ============================================================================
router.post("/sync", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("No authorization token provided", 401);
    }

    const token = authHeader.substring(7);
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      throw new AppError("Invalid or expired token", 401);
    }

    const body = (req.body ?? {}) as { name?: unknown; role?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const role = parseSyncRole(body.role);

    const mergedMetadata = {
      ...(supabaseUser.user_metadata ?? {}),
      ...(name ? { name, full_name: name } : {}),
      ...(role ? { role } : {}),
    };

    const syncedUser = await syncSupabaseUserToDatabase({
      ...supabaseUser,
      user_metadata: mergedMetadata,
    });

    const fullUser = await findAuthUserById(syncedUser.id);
    if (!fullUser) {
      throw new AppError("Failed to sync user", 500);
    }

    const scope = await buildUserScope(fullUser.id, fullUser.role as RoleType);
    const authUser: AuthUser = { ...fullUser, role: fullUser.role as RoleType, scope } as AuthUser;

    void logActivity(fullUser.id, "auth.synced", { supabaseId: fullUser.supabaseId });

    res.json({ success: true, data: authUser });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/auth/logout
// Revokes session server-side to invalidate JWT
// ============================================================================
router.post("/logout", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser(token);
      const dbUser = supabaseUser
        ? await prisma.user.findUnique({ where: { supabaseId: supabaseUser.id }, select: { id: true } })
        : null;
      // Revoke the session via admin API (invalidates the token server-side)
      await supabase.auth.admin.signOut(token);
      if (dbUser) {
        void logActivity(dbUser.id, "auth.logout");
      }
    }

    const response: LogoutResponse = {
      success: true,
    };

    res.json(response);
  } catch (err) {
    // Don't block client logout even if server revocation fails
    console.error("Logout error:", err);
    res.json({ success: true });
  }
});

// ============================================================================
// PATCH /api/auth/profile
// Updates authenticated user's profile
// ============================================================================
router.patch("/profile", authenticate, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { name, handle, bio, phoneNumber, skills, college, batch, department, githubUsername, isPublic, socialLinks } = req.body;
    const canEditAcademicIdentity = req.user!.role !== Role.STUDENT;

    const nextHandle = handle
      ? await ensureUniqueHandle(name ?? req.user!.name, handle, req.user!.id)
      : undefined;

    const updates = [];
    
    if (name || githubUsername !== undefined) {
      updates.push(
        prisma.user.update({
          where: { id: req.user!.id },
          data: {
            ...(name && canEditAcademicIdentity ? { name } : {}),
            ...(githubUsername !== undefined && { githubUsername }),
          },
        })
      );
    }

    if (githubUsername !== undefined) {
      updates.push(
        prisma.studentProfile.upsert({
          where: { userId: req.user!.id },
          update: { githubUsername },
          create: { userId: req.user!.id, githubUsername },
        })
      );
    }

    updates.push(
      prisma.profile.upsert({
        where: { userId: req.user!.id },
        update: {
          ...(nextHandle !== undefined && { handle: nextHandle }),
          ...(bio !== undefined && { bio }),
          ...(phoneNumber !== undefined && { phoneNumber }),
          ...(skills !== undefined && { skills }),
          ...(college !== undefined && { college }),
          ...(batch !== undefined && canEditAcademicIdentity ? { batch } : {}),
          ...(department !== undefined && canEditAcademicIdentity ? { department } : {}),
          ...(isPublic !== undefined && { isPublic }),
          ...(socialLinks !== undefined && { socialLinks }),
        },
        create: {
          userId: req.user!.id,
          handle: nextHandle,
          bio,
          skills: skills ?? [],
          college,
          batch: canEditAcademicIdentity ? batch : undefined,
          department: canEditAcademicIdentity ? department : undefined,
          isPublic: isPublic ?? false,
          socialLinks,
        },
      })
    );

    const results = await prisma.$transaction(updates);
    const user = updates.length > 1 ? results[0] : undefined;
    const profile = results.find((r: any) => r && 'handle' in r && 'bio' in r);

    if (githubUsername) {
      import("../jobs/platformSync.job.js")
        .then(({ syncStudentProfileByUserId }) => syncStudentProfileByUserId(req.user!.id, "github"))
        .catch((err) => console.error("Failed to sync github profile on update:", err));
    }

    res.json({ success: true, data: { user, profile } });
  } catch (err) {
    next(err);
  }
});

export default router;
