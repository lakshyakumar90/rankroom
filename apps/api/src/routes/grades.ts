import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { Role } from "@repo/types";
import { authenticate, canAccessSection } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { bulkCreateGradesSchema, createGradeSchema } from "@repo/validators";
import { logActivity } from "../lib/activity";
import { recomputeSectionLeaderboard } from "../services/leaderboard.service";
import { calculateStudentCgpa, syncStudentProfileCgpa } from "../services/cgpa.service";

const router: ExpressRouter = Router();
router.use(authenticate);

function canManageGrades(role: Role) {
  return [
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.DEPARTMENT_HEAD,
    Role.CLASS_COORDINATOR,
    Role.TEACHER,
  ].includes(role);
}

async function ensureSubjectGradeAccess(
  user: NonNullable<Express.Request["user"]>,
  subjectId: string
) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      code: true,
      sectionId: true,
      departmentId: true,
      section: { select: { id: true, name: true, code: true } },
    },
  });

  if (!subject) {
    throw new AppError("Subject not found", 404);
  }

  const allowed = await canAccessSection(
    user,
    subject.sectionId,
    user.role === Role.TEACHER ? subject.id : undefined
  );

  if (!allowed || !canManageGrades(user.role)) {
    throw new AppError("Forbidden", 403);
  }

  return subject;
}

async function ensureStudentsInSection(studentIds: string[], sectionId: string) {
  const uniqueStudentIds = [...new Set(studentIds)];
  if (uniqueStudentIds.length === 0) return;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      sectionId,
      studentId: { in: uniqueStudentIds },
    },
    select: { studentId: true },
  });

  if (enrollments.length !== uniqueStudentIds.length) {
    throw new AppError("One or more students are outside the subject section", 400);
  }
}

async function ensureGradeAccess(
  user: NonNullable<Express.Request["user"]>,
  gradeId: string
) {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          sectionId: true,
          section: { select: { id: true, name: true, code: true } },
        },
      },
      student: { select: { id: true, name: true } },
    },
  });

  if (!grade) {
    throw new AppError("Grade not found", 404);
  }

  if (user.role === Role.STUDENT) {
    if (grade.studentId !== user.id) {
      throw new AppError("Forbidden", 403);
    }
    return grade;
  }

  const allowed = await canAccessSection(
    user,
    grade.subject.sectionId,
    user.role === Role.TEACHER ? grade.subjectId : undefined
  );

  if (!allowed || !canManageGrades(user.role)) {
    throw new AppError("Forbidden", 403);
  }

  return grade;
}

router.post("/", validate(createGradeSchema), async (req, res, next) => {
  try {
    const subject = await ensureSubjectGradeAccess(req.user!, req.body.subjectId);
    await ensureStudentsInSection([req.body.studentId], subject.sectionId);

    const grade = await prisma.grade.create({
      data: {
        studentId: req.body.studentId,
        subjectId: req.body.subjectId,
        teacherId: req.user!.id,
        examType: req.body.examType,
        marks: req.body.marks,
        maxMarks: req.body.maxMarks,
        semester: req.body.semester,
        remarks: req.body.remarks,
      },
      include: {
        student: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.notification.create({
      data: {
        userId: grade.studentId,
        type: "ASSIGNMENT_GRADED",
        title: "Grade Published",
        message: `${grade.subject.name} ${grade.examType.toLowerCase()} marks published: ${grade.marks}/${grade.maxMarks}`,
        link: `/grades/student/${grade.studentId}`,
        entityId: grade.id,
        entityType: "GRADE",
        targetRole: Role.STUDENT,
        targetSectionId: subject.sectionId,
        targetDepartmentId: subject.departmentId,
      },
    });

    await logActivity(req.user!.id, "grade.created", {
      gradeId: grade.id,
      studentId: grade.studentId,
      subjectId: grade.subjectId,
    });

    await syncStudentProfileCgpa(grade.studentId);
    await recomputeSectionLeaderboard(subject.sectionId);

    res.status(201).json({ success: true, data: grade });
  } catch (error) {
    next(error);
  }
});

router.post("/bulk", validate(bulkCreateGradesSchema), async (req, res, next) => {
  try {
    const { subjectId, examType, maxMarks, semester, grades } = req.body as {
      subjectId: string;
      examType: "MID" | "FINAL" | "INTERNAL" | "ASSIGNMENT";
      maxMarks: number;
      semester: number;
      grades: { studentId: string; marks: number; remarks?: string }[];
    };

    const subject = await ensureSubjectGradeAccess(req.user!, subjectId);
    await ensureStudentsInSection(grades.map((entry) => entry.studentId), subject.sectionId);

    const upserted = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const entry of grades) {
        const existing = await tx.grade.findFirst({
          where: {
            studentId: entry.studentId,
            subjectId,
            examType,
            semester,
          },
          select: { id: true },
        });

        if (existing) {
          results.push(
            await tx.grade.update({
              where: { id: existing.id },
              data: {
                marks: entry.marks,
                remarks: entry.remarks,
                maxMarks,
                teacherId: req.user!.id,
              },
            })
          );
          continue;
        }

        results.push(
          await tx.grade.create({
            data: {
              studentId: entry.studentId,
              subjectId,
              teacherId: req.user!.id,
              examType,
              marks: entry.marks,
              maxMarks,
              semester,
              remarks: entry.remarks,
            },
          })
        );
      }

      return results;
    });

    await logActivity(req.user!.id, "grade.bulk_created", {
      subjectId,
      count: upserted.length,
      examType,
      semester,
    });

    const affectedStudentIds = Array.from(new Set(upserted.map((entry) => entry.studentId)));
    await Promise.all(affectedStudentIds.map((studentId) => syncStudentProfileCgpa(studentId)));
    await recomputeSectionLeaderboard(subject.sectionId);

    res.status(201).json({
      success: true,
      data: upserted,
      message: `${upserted.length} grades saved`,
    });
  } catch (error) {
    next(error);
  }
});

router.get(["/section/:sectionId", "/class/:classId"], async (req, res, next) => {
  try {
    if (!canManageGrades(req.user!.role)) {
      throw new AppError("Forbidden", 403);
    }

    const sectionId = req.params.sectionId ?? req.params.classId;
    if (!sectionId) {
      throw new AppError("Section id is required", 400);
    }

    const allowed = await canAccessSection(req.user!, sectionId);
    if (!allowed) {
      throw new AppError("Forbidden", 403);
    }

    const { subjectId, examType, semester } = req.query as Record<string, string>;

    const grades = await prisma.grade.findMany({
      where: {
        subject: { sectionId },
        ...(subjectId ? { subjectId } : {}),
        ...(examType ? { examType: examType as "MID" | "FINAL" | "INTERNAL" | "ASSIGNMENT" } : {}),
        ...(semester ? { semester: Number.parseInt(semester, 10) } : {}),
      },
      include: {
        student: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: grades });
  } catch (error) {
    next(error);
  }
});

router.get("/student/:studentId", async (req, res, next) => {
  try {
    if (req.user!.role === Role.STUDENT && req.user!.id !== req.params.studentId) {
      throw new AppError("Forbidden", 403);
    }

    if (req.user!.role !== Role.STUDENT) {
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId: req.params.studentId },
        select: { sectionId: true },
      });

      if (!enrollment) {
        throw new AppError("Student enrollment not found", 404);
      }

      const allowed = await canAccessSection(req.user!, enrollment.sectionId);
      if (!allowed) {
        throw new AppError("Forbidden", 403);
      }
    }

    const grades = await prisma.grade.findMany({
      where: { studentId: req.params.studentId },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: grades });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const grade = await ensureGradeAccess(req.user!, req.params.id);
    if (req.user!.role === Role.STUDENT) {
      throw new AppError("Students cannot update grades", 403);
    }

    const updated = await prisma.grade.update({
      where: { id: grade.id },
      data: {
        ...(req.body.marks !== undefined ? { marks: req.body.marks } : {}),
        ...(req.body.maxMarks !== undefined ? { maxMarks: req.body.maxMarks } : {}),
        ...(req.body.remarks !== undefined ? { remarks: req.body.remarks } : {}),
        ...(req.body.semester !== undefined ? { semester: req.body.semester } : {}),
        teacherId: req.user!.id,
      },
    });

    await logActivity(req.user!.id, "grade.updated", { gradeId: updated.id });
    await syncStudentProfileCgpa(updated.studentId);
    await recomputeSectionLeaderboard(grade.subject.sectionId);

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.get("/student/:studentId/cgpa", async (req, res, next) => {
  try {
    if (req.user!.role === Role.STUDENT && req.user!.id !== req.params.studentId) {
      throw new AppError("Forbidden", 403);
    }

    if (req.user!.role !== Role.STUDENT) {
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId: req.params.studentId },
        select: { sectionId: true },
      });

      if (!enrollment) {
        throw new AppError("Student enrollment not found", 404);
      }

      const allowed = await canAccessSection(req.user!, enrollment.sectionId);
      if (!allowed) {
        throw new AppError("Forbidden", 403);
      }
    }

    const cgpaData = await calculateStudentCgpa(req.params.studentId);
    res.json({ success: true, data: cgpaData });
  } catch (error) {
    next(error);
  }
});

router.get("/subject/:subjectId/report", async (req, res, next) => {
  try {
    const subject = await ensureSubjectGradeAccess(req.user!, req.params.subjectId);

    const grades = await prisma.grade.findMany({
      where: { subjectId: subject.id },
      include: { student: { select: { id: true, name: true } } },
      orderBy: [{ examType: "asc" }, { student: { name: "asc" } }],
    });

    const studentMap = new Map<
      string,
      { name: string; grades: Record<string, { marks: number; maxMarks: number }> }
    >();

    for (const grade of grades) {
      if (!studentMap.has(grade.studentId)) {
        studentMap.set(grade.studentId, { name: grade.student.name, grades: {} });
      }

      studentMap.get(grade.studentId)!.grades[grade.examType] = {
        marks: grade.marks,
        maxMarks: grade.maxMarks,
      };
    }

    res.json({
      success: true,
      data: Array.from(studentMap.entries()).map(([studentId, value]) => ({
        studentId,
        ...value,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
