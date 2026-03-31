import { Router, type Router as ExpressRouter } from "express";
import { prisma, Prisma } from "@repo/database";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  assignBatchCoordinatorsSchema,
  createBatchSchema,
  createDepartmentSchema,
  createUserSchema,
  enrollStudentsSchema,
} from "@repo/validators";
import { AppError } from "../middleware/error";
import { Role } from "@repo/types";
import { supabase } from "../lib/supabase";
import { ensureUniqueHandle } from "../lib/handles";
import { z } from "zod";

const router: ExpressRouter = Router();
router.use(authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN));

const adminCreateSubjectSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(20).transform((value) => value.toUpperCase()),
  teacherId: z.string().cuid().optional().nullable(),
});

function isSchemaMismatchError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

async function findAdminUsers(where: Record<string, unknown>, skip: number, take: number) {
  try {
    return await prisma.user.findMany({
      where,
      include: {
        profile: true,
        departmentHeaded: { select: { id: true, name: true, code: true } },
        coordinatedSection: { select: { id: true, name: true, code: true } },
        enrollments: { include: { section: { include: { department: true } } }, take: 1 },
        teachingAssignments: {
          include: { section: { include: { department: true } }, subject: true },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) {
      throw error;
    }

    return prisma.user.findMany({
      where,
      include: {
        profile: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
  }
}

router.get("/users", async (req, res, next) => {
  try {
    const { page = "1", limit = "20", role, search } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = {
      ...(role ? { role: role as Role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      findAdminUsers(where, skip, parseInt(limit, 10)),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
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

router.post("/users", validate(createUserSchema), async (req, res, next) => {
  try {
    const { email, name, role, password, sectionId, subjectIds, departmentId } = req.body as {
      email: string;
      name: string;
      role: Role;
      password: string;
      sectionId?: string;
      subjectIds?: string[];
      departmentId?: string;
    };

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, full_name: name, role },
    });

    if (authError || !authData.user) {
      throw new AppError(authError?.message ?? "Failed to create auth user", 400);
    }

    const handle = await ensureUniqueHandle(name);
    const user = await prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        email,
        name,
        role,
        isVerified: true,
        profile: { create: { handle } },
        ...(role === Role.STUDENT ? { leaderboard: { create: {} }, studentProfile: { create: {} } } : {}),
      },
      include: { profile: true, studentProfile: true },
    });

    if (role === Role.STUDENT && sectionId) {
      await prisma.enrollment.create({
        data: { studentId: user.id, sectionId },
      });
    }

    if (role === Role.DEPARTMENT_HEAD && departmentId) {
      await prisma.department.update({
        where: { id: departmentId },
        data: { headId: user.id },
      });
    }

    if ((role === Role.TEACHER || role === Role.CLASS_COORDINATOR) && sectionId && subjectIds?.length) {
      await prisma.teacherSubjectAssignment.createMany({
        data: subjectIds.map((subjectId) => ({
          teacherId: user.id,
          subjectId,
          sectionId,
        })),
        skipDuplicates: true,
      });
    }

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        profile: true,
        enrollments: { select: { sectionId: true } },
      },
    });

    if (!target) {
      throw new AppError("User not found", 404);
    }

    const {
      name,
      githubUsername,
      handle,
      bio,
      college,
      batch,
      department,
      isPublic,
      sectionId,
      departmentId,
    } = req.body as {
      name?: string;
      githubUsername?: string | null;
      handle?: string;
      bio?: string | null;
      college?: string | null;
      batch?: string | null;
      department?: string | null;
      isPublic?: boolean;
      sectionId?: string | null;
      departmentId?: string | null;
    };

    const nextHandle =
      typeof handle === "string" && handle.trim().length > 0
        ? await ensureUniqueHandle(name ?? target.name, handle, target.id)
        : undefined;

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(githubUsername !== undefined ? { githubUsername } : {}),
        },
      }),
      prisma.profile.upsert({
        where: { userId: target.id },
        update: {
          ...(nextHandle !== undefined ? { handle: nextHandle } : {}),
          ...(bio !== undefined ? { bio } : {}),
          ...(college !== undefined ? { college } : {}),
          ...(batch !== undefined ? { batch } : {}),
          ...(department !== undefined ? { department } : {}),
          ...(isPublic !== undefined ? { isPublic } : {}),
        },
        create: {
          userId: target.id,
          handle: nextHandle,
          bio,
          college,
          batch,
          department,
          isPublic: isPublic ?? false,
          skills: [],
        },
      }),
    ]);

    if (target.role === Role.STUDENT && sectionId !== undefined) {
      await prisma.enrollment.deleteMany({ where: { studentId: target.id } });
      if (sectionId) {
        await prisma.enrollment.create({
          data: { studentId: target.id, sectionId },
        });
      }
    }

    if (target.role === Role.DEPARTMENT_HEAD && departmentId !== undefined) {
      await prisma.department.updateMany({
        where: { headId: target.id },
        data: { headId: null },
      });

      if (departmentId) {
        await prisma.department.update({
          where: { id: departmentId },
          data: { headId: target.id },
        });
      }
    }

    const data = await prisma.user.findUnique({
      where: { id: target.id },
      include: {
        profile: true,
        enrollments: { include: { section: { include: { department: true } } }, take: 1 },
      },
    });

    res.json({ success: true, data: data ?? user });
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError("User not found", 404);

    await supabase.auth.admin.deleteUser(user.supabaseId);
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/departments", async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        head: { select: { id: true, name: true, email: true, role: true } },
        sections: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
});

router.post("/departments", validate(createDepartmentSchema), async (req, res, next) => {
  try {
    const dept = await prisma.department.create({ data: req.body });
    res.status(201).json({ success: true, data: dept });
  } catch (error) {
    next(error);
  }
});

router.patch("/departments/:id", async (req, res, next) => {
  try {
    const dept = await prisma.department.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: dept });
  } catch (error) {
    next(error);
  }
});

router.get("/classes", async (_req, res, next) => {
  try {
    const sections = await prisma.section.findMany({
      include: {
        department: true,
        legacyTeacher: { select: { id: true, name: true, email: true, role: true } },
        coordinator: { select: { id: true, name: true, email: true, role: true } },
        subjects: { select: { id: true } },
        _count: { select: { enrollments: true, teacherAssignments: true, subjects: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: sections });
  } catch (error) {
    next(error);
  }
});

router.post("/classes", validate(createBatchSchema), async (req, res, next) => {
  try {
    const code =
      typeof req.body.code === "string" && req.body.code.length > 0
        ? req.body.code
        : String(req.body.name).split("Section ").pop()?.trim()?.toUpperCase() || `SEC-${Date.now().toString().slice(-4)}`;
    const academicYear =
      typeof req.body.academicYear === "string"
        ? req.body.academicYear
        : `${req.body.year}-${String((req.body.year + 1) % 100).padStart(2, "0")}`;

    const section = await prisma.section.create({
      data: {
        name: req.body.name,
        code,
        semester: req.body.semester,
        academicYear,
        departmentId: req.body.departmentId,
        legacyTeacherId: req.body.teacherId ?? null,
      },
      include: {
        department: true,
        coordinator: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({ success: true, data: section });
  } catch (error) {
    next(error);
  }
});

router.post("/classes/:id/coordinators", validate(assignBatchCoordinatorsSchema), async (req, res, next) => {
  try {
    const coordinatorId = req.body.coordinatorIds[0] ?? null;
    const section = await prisma.section.update({
      where: { id: req.params.id },
      data: { coordinatorId },
      include: {
        coordinator: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    res.json({ success: true, data: section });
  } catch (error) {
    next(error);
  }
});

router.post("/classes/:id/enroll", validate(enrollStudentsSchema), async (req, res, next) => {
  try {
    await prisma.enrollment.createMany({
      data: req.body.studentIds.map((studentId: string) => ({
        studentId,
        sectionId: req.params.id,
      })),
      skipDuplicates: true,
    });
    res.json({ success: true, message: "Students enrolled successfully" });
  } catch (error) {
    next(error);
  }
});

router.get("/classes/:id/subjects", async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { sectionId: req.params.id },
      include: {
        teacherAssignments: {
          include: {
            teacher: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });

    res.json({ success: true, data: subjects });
  } catch (error) {
    next(error);
  }
});

router.post("/classes/:id/subjects", validate(adminCreateSubjectSchema), async (req, res, next) => {
  try {
    const section = await prisma.section.findUnique({
      where: { id: req.params.id },
      select: { id: true, departmentId: true },
    });

    if (!section) {
      throw new AppError("Class not found", 404);
    }

    const subject = await prisma.subject.create({
      data: {
        name: req.body.name,
        code: req.body.code,
        sectionId: section.id,
        departmentId: section.departmentId,
        teacherId: req.body.teacherId ?? null,
      },
      include: {
        teacherAssignments: {
          include: {
            teacher: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    if (req.body.teacherId) {
      await prisma.teacherSubjectAssignment.createMany({
        data: [{ teacherId: req.body.teacherId, subjectId: subject.id, sectionId: section.id }],
        skipDuplicates: true,
      });
    }

    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    next(error);
  }
});

export default router;
