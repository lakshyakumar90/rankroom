import type { NextFunction, Request, Response } from "express";
import { prisma } from "@repo/database";
import { Role, type JWTPayload } from "@repo/types";
import { AppError } from "./error";
import {
  buildUserScope,
  canUserAccessDepartment,
  canUserAccessSection,
} from "../services/scope.service";
import { createRemoteJWKSet, jwtVerify } from "jose";

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

const jwtIssuer = `${SUPABASE_URL}/auth/v1`;
const jwksUrl = new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
const jwks = createRemoteJWKSet(jwksUrl);

async function loadDatabaseUser(supabaseId: string) {
  const user = await prisma.user.findUnique({
    where: { supabaseId },
    select: {
      id: true,
      supabaseId: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
      githubUsername: true,
    },
  });

  if (!user) {
    return null;
  }

  const role = user.role as Role;
  const scope = await buildUserScope(user.id, role);
  return { ...user, role, scope };
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "No authorization token provided" });
    return;
  }

  try {
    const token = authHeader.substring(7);

    let supabaseId: string | undefined;
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: jwtIssuer,
        audience: "authenticated",
        algorithms: ["ES256"],
      });
      supabaseId = typeof payload.sub === "string" ? payload.sub : undefined;
    } catch (jwtError) {
      console.error("JWT verification failed:", jwtError);
      res.status(401).json({ success: false, error: "Invalid or expired token" });
      return;
    }

    if (!supabaseId) {
      console.error("No sub (user ID) in JWT");
      res.status(401).json({ success: false, error: "Invalid token" });
      return;
    }

    // Load user from database
    const dbUser = await loadDatabaseUser(supabaseId);
    if (!dbUser) {
      console.error("User not found in database. Supabase ID:", supabaseId);
      // Return 404 so frontend knows to call /auth/sync
      res.status(404).json({ 
        success: false, 
        error: "User not found in database",
        supabaseId 
      });
      return;
    }

    req.user = dbUser;
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN) {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: "Insufficient permissions" });
      return;
    }

    next();
  };
}

export async function canAccessDepartment(user: NonNullable<Express.Request["user"]>, departmentId: string) {
  return canUserAccessDepartment(user, departmentId);
}

export async function canAccessSection(
  user: NonNullable<Express.Request["user"]>,
  sectionId: string,
  subjectId?: string | null
) {
  return canUserAccessSection(user, sectionId, subjectId);
}

export async function canAccessBatch(
  user: NonNullable<Express.Request["user"]>,
  batchId: string,
  subjectId?: string | null
) {
  return canAccessSection(user, batchId, subjectId);
}

export function requireBatchAccess() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("Unauthorized", 401);
      const sectionId = req.params["classId"] ?? req.params["batchId"] ?? req.params["sectionId"] ?? req.body?.sectionId ?? req.body?.batchId;
      const subjectId = req.params["subjectId"] ?? req.body?.subjectId ?? null;
      if (!sectionId) throw new AppError("Section id is required", 400);

      const allowed = await canAccessSection(req.user, sectionId, subjectId);
      if (!allowed) throw new AppError("Forbidden", 403);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.substring(7);
  void (async () => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: jwtIssuer,
        audience: "authenticated",
        algorithms: ["ES256"],
      });
      const supabaseId = typeof payload.sub === "string" ? payload.sub : undefined;

      if (!supabaseId) {
        next();
        return;
      }

      const dbUser = await loadDatabaseUser(supabaseId);
      if (dbUser) {
        req.user = dbUser;
      }

      next();
    } catch {
      next();
    }
  })();
}
