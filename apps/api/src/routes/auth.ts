import { Router } from "express";
import { prisma } from "@repo/database";
import { supabase } from "../lib/supabase";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { registerSchema, updateProfileSchema } from "@repo/validators";
import type { Role } from "@repo/types";

const router = Router();

// POST /api/auth/register - called after Supabase signup to create DB record
router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { email, name, role } = req.body as { email: string; name: string; role: Role };

    // This endpoint is called by the frontend after Supabase Auth creates the user
    // The frontend should pass the supabase user id via a verified token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Authorization token required", 401);
    }

    const token = authHeader.substring(7);
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      throw new AppError("Invalid token", 401);
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { supabaseId: supabaseUser.id } });
    if (existing) {
      res.json({ success: true, data: existing });
      return;
    }

    const user = await prisma.user.create({
      data: {
        supabaseId: supabaseUser.id,
        email,
        name,
        role: role ?? "STUDENT",
        isVerified: !!supabaseUser.email_confirmed_at,
        profile: { create: {} },
        leaderboard: { create: {} },
      },
      include: { profile: true },
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me - get current user
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true },
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/profile - update own profile
router.patch("/profile", authenticate, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { name, bio, skills, college, batch, department, githubUsername, socialLinks } = req.body;

    const [user, profile] = await prisma.$transaction([
      ...(name
        ? [prisma.user.update({ where: { id: req.user!.id }, data: { name, githubUsername } })]
        : []),
      prisma.profile.upsert({
        where: { userId: req.user!.id },
        update: { bio, skills, college, batch, department, socialLinks },
        create: { userId: req.user!.id, bio, skills: skills ?? [], college, batch, department, socialLinks },
      }),
    ]);

    res.json({ success: true, data: { user, profile } });
  } catch (err) {
    next(err);
  }
});

export default router;
