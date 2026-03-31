import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { authenticate, canAccessSection, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createSubjectSchema } from "@repo/validators";
import { AppError } from "../middleware/error";
import { Role } from "@repo/types";

const router: ExpressRouter = Router();
router.use(authenticate);

router.get(["/batch/:batchId", "/section/:sectionId"], async (req, res, next) => {
  try {
    const sectionId = req.params.batchId ?? req.params.sectionId;
    if (
      req.user!.role !== Role.SUPER_ADMIN &&
      req.user!.role !== Role.ADMIN &&
      !(await canAccessSection(req.user!, sectionId))
    ) {
      throw new AppError("Forbidden", 403);
    }

    const subjects = await prisma.subject.findMany({
      where: { sectionId },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: subjects });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD), validate(createSubjectSchema), async (req, res, next) => {
  try {
    const subject = await prisma.subject.create({ data: req.body });
    if (req.body.teacherId) {
      await prisma.teacherSubjectAssignment.createMany({
        data: [
          {
            teacherId: req.body.teacherId,
            subjectId: subject.id,
            sectionId: req.body.sectionId,
          },
        ],
        skipDuplicates: true,
      });
    }
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req, res, next) => {
  try {
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Subject deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
