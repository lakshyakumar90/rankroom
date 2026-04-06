import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { prisma } from "@repo/database";
import { subjectResultComponentSchema, bulkResultImportSchema } from "@repo/validators";
import { upsertStudentResult, bulkUpsertResults, validateResultComponents, getSubjectResultConfig } from "../services/result-validation.service";
import { canAccessSection } from "../middleware/auth";
import { z } from "zod";

const router: ExpressRouter = Router();
router.use(authenticate);

// POST /api/results/subjects/:subjectId/components — upsert marks for one student
router.post(
  "/subjects/:subjectId/components",
  requirePermission("grades:create"),
  validate(z.object({ body: subjectResultComponentSchema })),
  async (req, res, next) => {
    try {
      const subject = await prisma.subject.findUnique({
        where: { id: req.params.subjectId },
        select: { id: true, sectionId: true },
      });
      if (!subject) throw new AppError("Subject not found", 404);

      const allowed = await canAccessSection(req.user!, subject.sectionId);
      if (!allowed) throw new AppError("Forbidden", 403);

      const { studentId, semester, midTerm, endTerm, assignment, tc, remarks } = req.body as {
        studentId: string;
        semester: number;
        midTerm?: number;
        endTerm?: number;
        assignment?: number;
        tc?: number;
        remarks?: string;
      };

      const result = await upsertStudentResult({
        studentId,
        subjectId: req.params.subjectId,
        teacherId: req.user!.id,
        semester,
        components: { midTerm, endTerm, assignment, tc },
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/results/subjects/:subjectId/import — bulk import with row-level errors
router.post(
  "/subjects/:subjectId/import",
  requirePermission("grades:create"),
  validate(z.object({ body: bulkResultImportSchema.omit({ subjectId: true }) })),
  async (req, res, next) => {
    try {
      const subject = await prisma.subject.findUnique({
        where: { id: req.params.subjectId },
        select: { id: true, sectionId: true },
      });
      if (!subject) throw new AppError("Subject not found", 404);

      const allowed = await canAccessSection(req.user!, subject.sectionId);
      if (!allowed) throw new AppError("Forbidden", 403);

      const { semester, rows } = req.body as { semester: number; rows: Array<{ studentId: string; midTerm?: number; endTerm?: number; assignment?: number; tc?: number }> };

      const result = await bulkUpsertResults({
        subjectId: req.params.subjectId,
        teacherId: req.user!.id,
        semester,
        rows,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/results/subjects/:subjectId/config — get marks config for UI validation
router.get("/subjects/:subjectId/config", async (req, res, next) => {
  try {
    const config = await getSubjectResultConfig(req.params.subjectId);
    res.json({
      success: true,
      data: {
        ...config,
        totalMax: config.maxMidTerm + config.maxEndTerm + config.maxAssignment + config.maxTC,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/results/subjects/:subjectId/validate — validate components without saving
router.post("/subjects/:subjectId/validate", async (req, res, next) => {
  try {
    const components = req.body as { midTerm?: number; endTerm?: number; assignment?: number; tc?: number };
    const result = await validateResultComponents(req.params.subjectId, components);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/results/sections/:sectionId — all grades for a section
router.get(
  "/sections/:sectionId",
  requirePermission("grades:read:section"),
  async (req, res, next) => {
    try {
      const allowed = await canAccessSection(req.user!, req.params.sectionId);
      if (!allowed) throw new AppError("Forbidden", 403);

      const grades = await prisma.grade.findMany({
        where: { subject: { sectionId: req.params.sectionId } },
        include: {
          student: { select: { id: true, name: true, avatar: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ subject: { name: "asc" } }, { student: { name: "asc" } }],
      });

      res.json({ success: true, data: grades });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
