import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { authenticate, canAccessSection, optionalAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/error";
import { Role } from "@repo/types";
import { fallbackHandle } from "../lib/handles";
import { getStudentProfile, updateBasicProfile, updateOwnStudentProfile } from "../services/student-profile.service";

const router: ExpressRouter = Router();

router.get("/me/classes", authenticate, async (req, res, next) => {
  try {
    const where =
      req.user!.role === Role.SUPER_ADMIN || req.user!.role === Role.ADMIN
        ? {}
        : req.user!.role === Role.DEPARTMENT_HEAD
          ? { departmentId: { in: req.user!.scope.departmentIds } }
          : { id: { in: req.user!.scope.sectionIds } };

    const sections = await prisma.section.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        coordinator: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { enrollments: true, teacherAssignments: true } },
      },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    });

    res.json({ success: true, data: sections });
  } catch (error) {
    next(error);
  }
});

router.get(
  ["/batch/:batchId/students", "/section/:sectionId/students"],
  authenticate,
  requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.CLASS_COORDINATOR, Role.DEPARTMENT_HEAD),
  async (req, res, next) => {
    try {
      const sectionId = req.params.batchId ?? req.params.sectionId;
      if (!(await canAccessSection(req.user!, sectionId))) {
        throw new AppError("Forbidden", 403);
      }

      const enrollments = await prisma.enrollment.findMany({
        where: { sectionId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              avatar: true,
              email: true,
              role: true,
              profile: { select: { handle: true } },
              studentProfile: {
                select: { cgpa: true, leetcodeSolved: true, githubContributions: true },
              },
            },
          },
        },
        orderBy: { student: { name: "asc" } },
      });

      res.json({ success: true, data: enrollments });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/public/:handle", optionalAuth, async (req, res, next) => {
  try {
    const requestedHandle = req.params.handle.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { profile: { is: { handle: { equals: requestedHandle, mode: "insensitive" } } } },
          { name: { equals: requestedHandle.replace(/-/g, " "), mode: "insensitive" } },
          { email: { equals: requestedHandle, mode: "insensitive" } },
          { githubUsername: { equals: requestedHandle, mode: "insensitive" } },
          { studentProfile: { is: { githubUsername: { equals: requestedHandle, mode: "insensitive" } } } },
          { studentProfile: { is: { leetcodeUsername: { equals: requestedHandle, mode: "insensitive" } } } },
          { studentProfile: { is: { codechefUsername: { equals: requestedHandle, mode: "insensitive" } } } },
          { studentProfile: { is: { codeforcesUsername: { equals: requestedHandle, mode: "insensitive" } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        githubUsername: true,
        role: true,
        createdAt: true,
        profile: true,
        leaderboard: true,
      },
    });

    if (!user) throw new AppError("User not found", 404);

    const detailed = await getStudentProfile(req.user, user.id);
    res.json({
      success: true,
      data: {
        ...detailed,
        profile: {
          ...(user.profile ?? {}),
          handle: user.profile?.handle ?? fallbackHandle(user.name, user.id),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/profile", optionalAuth, async (req, res, next) => {
  try {
    const data = await getStudentProfile(req.user, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/profile", authenticate, async (req, res, next) => {
  try {
    const isOwnProfile = req.user!.id === req.params.id;
    const canManageProfiles = [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR].includes(req.user!.role);
    if (!isOwnProfile && !canManageProfiles) {
      throw new AppError("Forbidden", 403);
    }

    const {
      name,
      bio,
      handle,
      githubUsername,
      avatar,
      isPublic,
      phoneNumber,
      leetcodeUsername,
      codechefUsername,
      codeforcesUsername,
      hackerrankUsername,
      cgpa,
    } = req.body as Record<string, unknown>;

    await updateBasicProfile(req.params.id, {
      ...(typeof name === "string" ? { name } : {}),
      ...(typeof bio === "string" ? { bio } : {}),
      ...(typeof handle === "string" ? { handle } : {}),
      ...(typeof githubUsername === "string" ? { githubUsername } : {}),
      ...(typeof avatar === "string" ? { avatar } : {}),
      ...(typeof isPublic === "boolean" ? { isPublic } : {}),
      ...(typeof phoneNumber === "string" ? { phoneNumber } : {}),
    });

    if (isOwnProfile) {
      await updateOwnStudentProfile(req.user!, {
        ...(typeof bio === "string" ? { bio } : {}),
        ...(typeof githubUsername === "string" ? { githubUsername } : {}),
        ...(typeof leetcodeUsername === "string" ? { leetcodeUsername } : {}),
        ...(typeof codechefUsername === "string" ? { codechefUsername } : {}),
        ...(typeof codeforcesUsername === "string" ? { codeforcesUsername } : {}),
        ...(typeof hackerrankUsername === "string" ? { hackerrankUsername } : {}),
        ...(typeof cgpa === "number" ? { cgpa } : {}),
        ...(typeof isPublic === "boolean" ? { isPublic } : {}),
      });
    } else if (
      typeof githubUsername === "string" ||
      typeof leetcodeUsername === "string" ||
      typeof codechefUsername === "string" ||
      typeof codeforcesUsername === "string" ||
      typeof hackerrankUsername === "string" ||
      typeof cgpa === "number" ||
      typeof isPublic === "boolean"
    ) {
      await prisma.studentProfile.upsert({
        where: { userId: req.params.id },
        update: {
          ...(typeof bio === "string" ? { bio } : {}),
          ...(typeof githubUsername === "string" ? { githubUsername } : {}),
          ...(typeof leetcodeUsername === "string" ? { leetcodeUsername } : {}),
          ...(typeof codechefUsername === "string" ? { codechefUsername } : {}),
          ...(typeof codeforcesUsername === "string" ? { codeforcesUsername } : {}),
          ...(typeof hackerrankUsername === "string" ? { hackerrankUsername } : {}),
          ...(typeof cgpa === "number" ? { cgpa } : {}),
          ...(typeof isPublic === "boolean" ? { isPublic } : {}),
        },
        create: {
          userId: req.params.id,
          ...(typeof bio === "string" ? { bio } : {}),
          ...(typeof githubUsername === "string" ? { githubUsername } : {}),
          ...(typeof leetcodeUsername === "string" ? { leetcodeUsername } : {}),
          ...(typeof codechefUsername === "string" ? { codechefUsername } : {}),
          ...(typeof codeforcesUsername === "string" ? { codeforcesUsername } : {}),
          ...(typeof hackerrankUsername === "string" ? { hackerrankUsername } : {}),
          ...(typeof cgpa === "number" ? { cgpa } : {}),
          ...(typeof isPublic === "boolean" ? { isPublic } : {}),
        },
      });
    }

    const data = await getStudentProfile(req.user, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/search", authenticate, requireRole(Role.ADMIN, Role.TEACHER, Role.DEPARTMENT_HEAD), async (req, res, next) => {
  try {
    const { q, role, limit = "20" } = req.query as { q?: string; role?: string; limit?: string };
    const users = await prisma.user.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(role ? { role: role as Role } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
      take: parseInt(limit, 10),
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/submissions", authenticate, async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    if (req.user!.role === Role.STUDENT && req.user!.id !== targetUserId) {
      throw new AppError("Forbidden", 403);
    }

    const { page = "1", limit = "20" } = req.query as { page?: string; limit?: string };
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where: { userId: targetUserId },
        include: {
          problem: { select: { title: true, slug: true, difficulty: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.submission.count({ where: { userId: targetUserId } }),
    ]);

    res.json({
      success: true,
      data: submissions,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
