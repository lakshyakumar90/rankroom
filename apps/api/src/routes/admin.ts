import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import {
  createDepartmentSchema,
  createBatchSchema,
  enrollStudentsSchema,
  createUserSchema,
} from "@repo/validators";
import { supabase } from "../lib/supabase";
import { Role } from "@repo/types";

const router = Router();
router.use(authenticate, requireRole(Role.ADMIN));

// ─── USERS ────────────────────────────────────────────────

// GET /api/admin/users
router.get("/users", async (req, res, next) => {
  try {
    const { page = "1", limit = "20", role, search } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(role ? { role: role as "ADMIN" | "TEACHER" | "STUDENT" } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, include: { profile: true }, orderBy: { createdAt: "desc" }, skip, take: parseInt(limit) }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: users, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users - create user with Supabase account
router.post("/users", validate(createUserSchema), async (req, res, next) => {
  try {
    const { email, name, role, password } = req.body as { email: string; name: string; role: Role; password: string };

    // Create in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) throw new AppError(authError?.message ?? "Failed to create auth user", 400);

    const user = await prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        email,
        name,
        role,
        isVerified: true,
        profile: { create: {} },
        ...(role === "STUDENT" ? { leaderboard: { create: {} } } : {}),
      },
      include: { profile: true },
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id
router.patch("/users/:id", async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError("User not found", 404);

    // Delete from Supabase Auth
    await supabase.auth.admin.deleteUser(user.supabaseId);
    await prisma.user.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    next(err);
  }
});

// ─── DEPARTMENTS ────────────────────────────────────────

// GET /api/admin/departments
router.get("/departments", async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      include: { head: { select: { id: true, name: true, email: true } }, batches: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: departments });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/departments
router.post("/departments", validate(createDepartmentSchema), async (req, res, next) => {
  try {
    const dept = await prisma.department.create({ data: req.body });
    res.status(201).json({ success: true, data: dept });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/departments/:id
router.patch("/departments/:id", async (req, res, next) => {
  try {
    const dept = await prisma.department.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: dept });
  } catch (err) {
    next(err);
  }
});

// ─── CLASSES / BATCHES ─────────────────────────────────

// GET /api/admin/classes
router.get("/classes", async (_req, res, next) => {
  try {
    const batches = await prisma.batch.findMany({
      include: {
        department: true,
        teacher: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: batches });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/classes
router.post("/classes", validate(createBatchSchema), async (req, res, next) => {
  try {
    const batch = await prisma.batch.create({
      data: req.body,
      include: { department: true, teacher: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/classes/:id/enroll
router.post("/classes/:id/enroll", validate(enrollStudentsSchema), async (req, res, next) => {
  try {
    const { studentIds } = req.body as { studentIds: string[] };
    const batchId = req.params.id;

    const enrollments = await prisma.$transaction(
      studentIds.map((studentId) =>
        prisma.enrollment.upsert({
          where: { studentId_batchId: { studentId, batchId } },
          update: {},
          create: { studentId, batchId },
        })
      )
    );

    res.status(201).json({ success: true, data: enrollments, message: `${enrollments.length} students enrolled` });
  } catch (err) {
    next(err);
  }
});

// ─── ANALYTICS ─────────────────────────────────────────

// GET /api/admin/analytics/overview
router.get("/analytics/overview", async (_req, res, next) => {
  try {
    const [totalUsers, totalProblems, totalSubmissions, totalContests, usersByRole, recentSubmissions] = await Promise.all([
      prisma.user.count(),
      prisma.problem.count({ where: { isPublished: true } }),
      prisma.submission.count(),
      prisma.contest.count(),
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.submission.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { name: true } }, problem: { select: { title: true } } } }),
    ]);

    res.json({
      success: true,
      data: { totalUsers, totalProblems, totalSubmissions, totalContests, usersByRole, recentSubmissions },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/analytics/engagement
router.get("/analytics/engagement", async (_req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [submissionsByDay, activeUsers, topProblems] = await Promise.all([
      prisma.submission.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: true,
        orderBy: { createdAt: "asc" },
      }),
      prisma.submission.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: true,
        orderBy: { _count: { userId: "desc" } },
        take: 10,
      }),
      prisma.submission.groupBy({
        by: ["problemId"],
        _count: true,
        orderBy: { _count: { problemId: "desc" } },
        take: 10,
      }),
    ]);

    res.json({ success: true, data: { submissionsByDay, activeUsers, topProblems } });
  } catch (err) {
    next(err);
  }
});

export default router;
