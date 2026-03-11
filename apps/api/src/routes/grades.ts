import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { createGradeSchema, bulkCreateGradesSchema } from "@repo/validators";
import { Role } from "@repo/types";

const router = Router();
router.use(authenticate);

// POST /api/grades - create grade
router.post("/", requireRole(Role.TEACHER, Role.ADMIN), validate(createGradeSchema), async (req, res, next) => {
  try {
    const grade = await prisma.grade.create({
      data: { ...req.body, teacherId: req.user!.id },
      include: {
        student: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });
    res.status(201).json({ success: true, data: grade });
  } catch (err) {
    next(err);
  }
});

// POST /api/grades/bulk - bulk create grades
router.post("/bulk", requireRole(Role.TEACHER, Role.ADMIN), validate(bulkCreateGradesSchema), async (req, res, next) => {
  try {
    const { subjectId, examType, maxMarks, semester, grades } = req.body as {
      subjectId: string;
      examType: string;
      maxMarks: number;
      semester: number;
      grades: { studentId: string; marks: number; remarks?: string }[];
    };

    const created = await prisma.$transaction(
      grades.map((g) =>
        prisma.grade.create({
          data: { subjectId, examType: examType as "MID" | "FINAL" | "INTERNAL" | "ASSIGNMENT", maxMarks, semester, teacherId: req.user!.id, ...g },
        })
      )
    );

    res.status(201).json({ success: true, data: created, message: `${created.length} grades created` });
  } catch (err) {
    next(err);
  }
});

// GET /api/grades/class/:classId - all grades for a class
router.get("/class/:classId", requireRole(Role.TEACHER, Role.ADMIN), async (req, res, next) => {
  try {
    const { subjectId, examType, semester } = req.query as Record<string, string>;

    const grades = await prisma.grade.findMany({
      where: {
        subject: { batchId: req.params.classId },
        ...(subjectId ? { subjectId } : {}),
        ...(examType ? { examType: examType as "MID" | "FINAL" | "INTERNAL" | "ASSIGNMENT" } : {}),
        ...(semester ? { semester: parseInt(semester) } : {}),
      },
      include: {
        student: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: grades });
  } catch (err) {
    next(err);
  }
});

// GET /api/grades/student/:studentId - student grades
router.get("/student/:studentId", async (req, res, next) => {
  try {
    // Students can only see their own grades
    if (req.user!.role === "STUDENT" && req.user!.id !== req.params.studentId) {
      throw new AppError("Forbidden", 403);
    }

    const grades = await prisma.grade.findMany({
      where: { studentId: req.params.studentId },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Calculate CGPA per subject
    const subjectGrades = new Map<string, { name: string; grades: typeof grades }>();
    for (const g of grades) {
      if (!subjectGrades.has(g.subjectId)) {
        subjectGrades.set(g.subjectId, { name: g.subject.name, grades: [] });
      }
      subjectGrades.get(g.subjectId)!.grades.push(g);
    }

    res.json({ success: true, data: grades });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/grades/:id
router.patch("/:id", requireRole(Role.TEACHER, Role.ADMIN), async (req, res, next) => {
  try {
    const grade = await prisma.grade.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: grade });
  } catch (err) {
    next(err);
  }
});

// GET /api/grades/subject/:subjectId/report
router.get("/subject/:subjectId/report", requireRole(Role.TEACHER, Role.ADMIN), async (req, res, next) => {
  try {
    const grades = await prisma.grade.findMany({
      where: { subjectId: req.params.subjectId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: [{ examType: "asc" }, { student: { name: "asc" } }],
    });

    // Aggregate by student
    const studentMap = new Map<string, { name: string; grades: Record<string, { marks: number; maxMarks: number }> }>();
    for (const g of grades) {
      if (!studentMap.has(g.studentId)) studentMap.set(g.studentId, { name: g.student.name, grades: {} });
      studentMap.get(g.studentId)!.grades[g.examType] = { marks: g.marks, maxMarks: g.maxMarks };
    }

    res.json({ success: true, data: Array.from(studentMap.entries()).map(([id, v]) => ({ studentId: id, ...v })) });
  } catch (err) {
    next(err);
  }
});

export default router;
