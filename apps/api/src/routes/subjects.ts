import { Router, type Router as ExpressRouter } from "express";
import { prisma, Prisma } from "@repo/database";
import { authenticate, canAccessSection } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { z } from "zod";
import { logActivity } from "../lib/activity";

const router: ExpressRouter = Router();
router.use(authenticate);

const updateSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    teacherId: z.string().optional().nullable(),
    resultConfig: z
      .object({
        maxMidTerm: z.number().min(0).optional(),
        maxEndTerm: z.number().min(0).optional(),
        maxAssignment: z.number().min(0).optional(),
        maxTC: z.number().min(0).optional(),
        credits: z.number().int().min(0).optional(),
      })
      .optional(),
  }),
});

// PATCH /api/subjects/:id — edit subject metadata and/or result config
router.patch(
  "/:id",
  requirePermission("subjects:update"),
  validate(updateSubjectSchema),
  async (req, res, next) => {
    try {
      const subject = await prisma.subject.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, code: true, teacherId: true, sectionId: true, departmentId: true },
      });
      if (!subject) throw new AppError("Subject not found", 404);

      const allowed = await canAccessSection(req.user!, subject.sectionId);
      if (!allowed) throw new AppError("Forbidden", 403);

      const { resultConfig, ...subjectUpdates } = req.body as {
        name?: string;
        code?: string;
        teacherId?: string | null;
        resultConfig?: {
          maxMidTerm?: number;
          maxEndTerm?: number;
          maxAssignment?: number;
          maxTC?: number;
          credits?: number;
        };
      };

      const updated = await prisma.$transaction(async (tx) => {
        // Log audit entry
        const oldValue: Record<string, Prisma.JsonValue> = {};
        const newValue: Record<string, Prisma.JsonValue> = {};
        for (const key of Object.keys(subjectUpdates) as Array<keyof typeof subjectUpdates>) {
          if (subjectUpdates[key] !== undefined && subjectUpdates[key] !== subject[key as keyof typeof subject]) {
            oldValue[key] = subject[key as keyof typeof subject] as Prisma.JsonValue;
            newValue[key] = subjectUpdates[key] as Prisma.JsonValue;
          }
        }
        if (Object.keys(newValue).length > 0) {
          await tx.subjectAuditLog.create({
            data: {
              subjectId: subject.id,
              actorId: req.user!.id,
              action: "UPDATE",
              oldValue: oldValue as Prisma.InputJsonValue,
              newValue: newValue as Prisma.InputJsonValue,
            },
          });
        }

        const updatedSubject = await tx.subject.update({
          where: { id: subject.id },
          data: {
            ...(subjectUpdates.name !== undefined ? { name: subjectUpdates.name } : {}),
            ...(subjectUpdates.code !== undefined ? { code: subjectUpdates.code } : {}),
            ...(subjectUpdates.teacherId !== undefined ? { teacherId: subjectUpdates.teacherId } : {}),
          },
        });

        if (resultConfig) {
          await tx.subjectResultConfig.upsert({
            where: { subjectId: subject.id },
            update: resultConfig,
            create: { subjectId: subject.id, ...resultConfig },
          });
        }

        return updatedSubject;
      });

      await logActivity(req.user!.id, "subject.updated", { subjectId: subject.id });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/subjects/:id/teacher — change teacher assignment shortcut
router.patch(
  "/:id/teacher",
  requirePermission("sections:assign-teacher"),
  async (req, res, next) => {
    try {
      const subject = await prisma.subject.findUnique({
        where: { id: req.params.id },
        select: { id: true, sectionId: true, name: true, teacherId: true },
      });
      if (!subject) throw new AppError("Subject not found", 404);

      const allowed = await canAccessSection(req.user!, subject.sectionId);
      if (!allowed) throw new AppError("Forbidden", 403);

      const { teacherId } = req.body as { teacherId: string | null };

      await prisma.$transaction([
        prisma.subject.update({ where: { id: subject.id }, data: { teacherId } }),
        prisma.subjectAuditLog.create({
          data: {
            subjectId: subject.id,
            actorId: req.user!.id,
            action: "CHANGE_TEACHER",
            oldValue: { teacherId: subject.teacherId },
            newValue: { teacherId },
          },
        }),
      ]);

      await logActivity(req.user!.id, "subject.teacher_changed", { subjectId: subject.id, teacherId });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/subjects/:id/archive
router.post(
  "/:id/archive",
  requirePermission("subjects:archive"),
  async (req, res, next) => {
    try {
      const subject = await prisma.subject.findUnique({
        where: { id: req.params.id },
        select: { id: true, sectionId: true },
      });
      if (!subject) throw new AppError("Subject not found", 404);

      const allowed = await canAccessSection(req.user!, subject.sectionId);
      if (!allowed) throw new AppError("Forbidden", 403);

      await prisma.$transaction([
        prisma.subject.update({
          where: { id: subject.id },
          data: { isArchived: true, archivedAt: new Date() },
        }),
        prisma.subjectAuditLog.create({
          data: {
            subjectId: subject.id,
            actorId: req.user!.id,
            action: "ARCHIVE",
            oldValue: Prisma.JsonNull,
            newValue: Prisma.JsonNull,
          },
        }),
      ]);

      await logActivity(req.user!.id, "subject.archived", { subjectId: subject.id });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/subjects/:id/audit-log
router.get(
  "/:id/audit-log",
  requirePermission("subjects:update"),
  async (req, res, next) => {
    try {
      const subject = await prisma.subject.findUnique({
        where: { id: req.params.id },
        select: { id: true, sectionId: true },
      });
      if (!subject) throw new AppError("Subject not found", 404);

      const allowed = await canAccessSection(req.user!, subject.sectionId);
      if (!allowed) throw new AppError("Forbidden", 403);

      const logs = await prisma.subjectAuditLog.findMany({
        where: { subjectId: subject.id },
        include: { actor: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
