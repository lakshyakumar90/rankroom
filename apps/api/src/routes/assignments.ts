import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { Role } from "@repo/types";
import { authenticate, canAccessSection } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { createAssignmentSchema, gradeSubmissionSchema } from "@repo/validators";
import { supabase } from "../lib/supabase";
import multer from "multer";
import { logActivity } from "../lib/activity";
import { recomputeSectionLeaderboard } from "../services/leaderboard.service";

const router: ExpressRouter = Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function canManageAssignments(role: Role) {
  return [
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.DEPARTMENT_HEAD,
    Role.CLASS_COORDINATOR,
    Role.TEACHER,
  ].includes(role);
}

async function ensureSubjectAssignmentAccess(
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

  if (!allowed) {
    throw new AppError("Forbidden", 403);
  }

  return subject;
}

async function ensureAssignmentAccess(
  user: NonNullable<Express.Request["user"]>,
  assignmentId: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      audience: { select: { studentId: true } },
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          sectionId: true,
          section: { select: { id: true, name: true, code: true } },
        },
      },
      teacher: { select: { id: true, name: true } },
    },
  });

  if (!assignment) {
    throw new AppError("Assignment not found", 404);
  }

  if (user.role === Role.STUDENT) {
    const hasExplicitAudience = assignment.audience.length > 0;
    if (hasExplicitAudience && !assignment.audience.some((entry) => entry.studentId === user.id)) {
      throw new AppError("Forbidden", 403);
    }

    const enrolled = await prisma.enrollment.findFirst({
      where: { studentId: user.id, sectionId: assignment.subject.sectionId },
      select: { id: true },
    });

    if (!enrolled) {
      throw new AppError("Forbidden", 403);
    }

    return assignment;
  }

  if (!canManageAssignments(user.role)) {
    throw new AppError("Insufficient permissions", 403);
  }

  const allowed = await canAccessSection(
    user,
    assignment.subject.sectionId,
    user.role === Role.TEACHER ? assignment.subjectId : undefined
  );

  if (!allowed) {
    throw new AppError("Forbidden", 403);
  }

  return assignment;
}

async function listAssignmentsForSection(sectionId: string, userId?: string) {
  const assignments = await prisma.assignment.findMany({
    where: { subject: { sectionId } },
    include: {
      audience: { select: { studentId: true } },
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          section: { select: { id: true, name: true, code: true } },
        },
      },
      teacher: { select: { id: true, name: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  if (!userId) {
    return assignments;
  }

  const visibleAssignments = assignments.filter(
    (assignment) =>
      assignment.audience.length === 0 || assignment.audience.some((entry) => entry.studentId === userId)
  );

  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      studentId: userId,
      assignmentId: { in: visibleAssignments.map((assignment) => assignment.id) },
    },
  });

  const submissionMap = new Map(submissions.map((submission) => [submission.assignmentId, submission]));
  return visibleAssignments.map((assignment) => ({
    ...assignment,
    mySubmission: submissionMap.get(assignment.id) ?? null,
  }));
}

router.get("/mine", async (req, res, next) => {
  try {
    if (req.user!.role === Role.STUDENT) {
      const sectionIds = req.user!.scope.sectionIds;
      const assignments = await Promise.all(sectionIds.map((sectionId) => listAssignmentsForSection(sectionId, req.user!.id)));
      res.json({ success: true, data: assignments.flat() });
      return;
    }

    const where =
      req.user!.role === Role.SUPER_ADMIN || req.user!.role === Role.ADMIN
        ? {}
        : { subject: { sectionId: { in: req.user!.scope.sectionIds } } };

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            section: { select: { id: true, name: true, code: true } },
          },
        },
        teacher: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    res.json({ success: true, data: assignments });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(createAssignmentSchema), async (req, res, next) => {
  try {
    if (!canManageAssignments(req.user!.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    const subject = await ensureSubjectAssignmentAccess(req.user!, req.body.subjectId);
    const targetStudentIds = Array.isArray(req.body.targetStudentIds) ? req.body.targetStudentIds as string[] : [];

    if (targetStudentIds.length > 0) {
      const eligibleStudents = await prisma.enrollment.findMany({
        where: {
          sectionId: subject.sectionId,
          studentId: { in: targetStudentIds },
        },
        select: { studentId: true },
      });

      if (eligibleStudents.length !== targetStudentIds.length) {
        throw new AppError("Some selected students are outside the assignment scope", 400);
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        subjectId: subject.id,
        teacherId: req.user!.id,
        dueDate: new Date(req.body.dueDate),
        maxScore: req.body.maxScore,
        audience: targetStudentIds.length
          ? {
              createMany: {
                data: targetStudentIds.map((studentId) => ({ studentId })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: {
        audience: { select: { studentId: true } },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            section: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    const enrollments = await prisma.enrollment.findMany({
      where: {
        sectionId: subject.sectionId,
        ...(targetStudentIds.length ? { studentId: { in: targetStudentIds } } : {}),
      },
      select: { studentId: true },
    });

    if (enrollments.length > 0) {
      await prisma.notification.createMany({
        data: enrollments.map((enrollment) => ({
          userId: enrollment.studentId,
          type: "ASSIGNMENT_POSTED",
          title: "New Assignment",
          message: `New assignment "${assignment.title}" has been posted in ${subject.name}`,
          link: `/assignments/${assignment.id}`,
          entityId: assignment.id,
          entityType: "ASSIGNMENT",
          targetRole: Role.STUDENT,
          targetSectionId: subject.sectionId,
          targetDepartmentId: subject.departmentId,
        })),
      });
    }

    await logActivity(req.user!.id, "assignment.created", {
      assignmentId: assignment.id,
      subjectId: assignment.subjectId,
      sectionId: subject.sectionId,
    });

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
});

router.get(["/section/:sectionId", "/class/:classId"], async (req, res, next) => {
  try {
    const sectionId = req.params.sectionId ?? req.params.classId;
    if (!sectionId) {
      throw new AppError("Section id is required", 400);
    }

    const allowed = await canAccessSection(req.user!, sectionId);
    if (!allowed) {
      throw new AppError("Forbidden", 403);
    }

    const data = await listAssignmentsForSection(
      sectionId,
      req.user!.role === Role.STUDENT ? req.user!.id : undefined
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const assignment = await ensureAssignmentAccess(req.user!, req.params.id);

    if (req.user!.role === Role.STUDENT) {
      const submission = await prisma.assignmentSubmission.findUnique({
        where: {
          assignmentId_studentId: {
            assignmentId: assignment.id,
            studentId: req.user!.id,
          },
        },
      });

      res.json({ success: true, data: { ...assignment, mySubmission: submission ?? null } });
      return;
    }

    res.json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const assignment = await ensureAssignmentAccess(req.user!, req.params.id);

    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        ...(req.body.title !== undefined ? { title: req.body.title } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
        ...(req.body.maxScore !== undefined ? { maxScore: req.body.maxScore } : {}),
        ...(req.body.dueDate !== undefined ? { dueDate: new Date(req.body.dueDate) } : {}),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await ensureAssignmentAccess(req.user!, req.params.id);
    await prisma.assignment.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Assignment deleted" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/submit", upload.single("file"), async (req, res, next) => {
  try {
    if (req.user!.role !== Role.STUDENT) {
      throw new AppError("Only students can submit assignments", 403);
    }

    const assignment = await ensureAssignmentAccess(req.user!, req.params.id);
    const existingSectionId = assignment.subject.sectionId;

    let fileUrl: string | undefined;

    if (req.file) {
      const fileName = `assignments/${req.params.id}/${req.user!.id}/${Date.now()}_${req.file.originalname}`;
      const { error } = await supabase.storage
        .from("submissions")
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

      if (error) {
        throw new AppError("File upload failed", 500);
      }

      const { data: urlData } = supabase.storage.from("submissions").getPublicUrl(fileName);
      fileUrl = urlData.publicUrl;
    }

    if (new Date() > assignment.dueDate) {
      throw new AppError("Assignment deadline has passed", 400);
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user!.id } },
      update: {
        fileUrl,
        submittedAt: new Date(),
        status: "SUBMITTED",
      },
      create: {
        assignmentId: req.params.id,
        studentId: req.user!.id,
        fileUrl,
        submittedAt: new Date(),
        status: "SUBMITTED",
      },
    });

    await logActivity(req.user!.id, "assignment.submitted", {
      assignmentId: req.params.id,
      status: submission.status,
    });

    await recomputeSectionLeaderboard(existingSectionId);

    res.json({ success: true, data: submission });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/submissions", async (req, res, next) => {
  try {
    const assignment = await ensureAssignmentAccess(req.user!, req.params.id);
    if (req.user!.role === Role.STUDENT) {
      throw new AppError("Students cannot view all submissions", 403);
    }

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: assignment.id },
      include: { student: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: { submittedAt: "desc" },
    });

    res.json({ success: true, data: submissions });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/grade/:submissionId", validate(gradeSubmissionSchema), async (req, res, next) => {
  try {
    const assignment = await ensureAssignmentAccess(req.user!, req.params.id);
    if (req.user!.role === Role.STUDENT) {
      throw new AppError("Students cannot grade submissions", 403);
    }

    const { score, feedback } = req.body as { score: number; feedback?: string };
    const submission = await prisma.assignmentSubmission.update({
      where: { id: req.params.submissionId },
      data: {
        score,
        feedback,
        status: "GRADED",
      },
      include: {
        student: { select: { id: true, name: true } },
      },
    });

    await prisma.notification.create({
      data: {
        userId: submission.studentId,
        type: "ASSIGNMENT_GRADED",
        title: "Assignment Graded",
        message: `Your assignment "${assignment.title}" has been graded: ${score}/${assignment.maxScore}`,
        link: `/assignments/${assignment.id}`,
        entityId: assignment.id,
        entityType: "ASSIGNMENT",
        targetRole: Role.STUDENT,
        targetSectionId: assignment.subject.sectionId,
      },
    });

    await logActivity(req.user!.id, "assignment.graded", {
      assignmentId: req.params.id,
      submissionId: submission.id,
      studentId: submission.studentId,
      score,
    });

    await recomputeSectionLeaderboard(assignment.subject.sectionId);

    res.json({ success: true, data: submission });
  } catch (error) {
    next(error);
  }
});

export default router;
