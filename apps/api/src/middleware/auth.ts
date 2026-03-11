import type { Request, Response, NextFunction } from "express";
import { prisma } from "@repo/database";
import { supabase } from "../lib/supabase";
import type { Role } from "@repo/types";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        supabaseId: string;
        email: string;
        name: string;
        role: Role;
      };
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "No authorization token provided" });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Verify the Supabase JWT
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      res.status(401).json({ success: false, error: "Invalid or expired token" });
      return;
    }

    // Find the user in our database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      select: { id: true, supabaseId: true, email: true, name: true, role: true },
    });

    if (!dbUser) {
      res.status(401).json({ success: false, error: "User not found in database" });
      return;
    }

    req.user = dbUser as typeof req.user & NonNullable<typeof req.user>;
    next();
  } catch {
    res.status(500).json({ success: false, error: "Authentication failed" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: "Insufficient permissions" });
      return;
    }

    next();
  };
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.substring(7);
  supabase.auth
    .getUser(token)
    .then(({ data: { user: supabaseUser } }) => {
      if (!supabaseUser) return next();
      return prisma.user.findUnique({
        where: { supabaseId: supabaseUser.id },
        select: { id: true, supabaseId: true, email: true, name: true, role: true },
      });
    })
    .then((dbUser) => {
      if (dbUser) req.user = dbUser as typeof req.user & NonNullable<typeof req.user>;
      next();
    })
    .catch(() => next());
}
