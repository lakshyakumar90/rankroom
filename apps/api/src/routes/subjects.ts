import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { createSubjectSchema } from "@repo/validators";
import { Role } from "@repo/types";

const router = Router();
router.use(authenticate);

// GET /api/subjects/batch/:batchId
router.get("/batch/:batchId", async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { batchId: req.params.batchId },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
});

// POST /api/subjects
router.post("/", requireRole(Role.ADMIN, Role.TEACHER), validate(createSubjectSchema), async (req, res, next) => {
  try {
    const subject = await prisma.subject.create({ data: req.body });
    res.status(201).json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/subjects/:id
router.delete("/:id", requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Subject deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
