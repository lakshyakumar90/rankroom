import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { createAssignmentSchema, gradeSubmissionSchema } from "@repo/validators";
import { supabase } from "../lib/supabase";
import multer from "multer";
import { Role } from "@repo/types";

const router = Router();
router.use(authenticate);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// POST /api/assignments - create assignment (teacher)
router.post("/", requireRole(Role.TEACHER, Role.ADMIN), validate(createAssignmentSchema), async (req, res, next) => {
  try {
    const assignment = await prisma.assignment.create({
      data: { ...req.body, teacherId: req.user!.id },
      include: { subject: { select: { id: true, name: true } } },
    });

    // Notify students via notifications
    const enrollments = await prisma.enrollment.findMany({
      where: { batch: { subjects: { some: { id: req.body.subjectId } } } },
      select: { studentId: true },
    });

    if (enrollments.length > 0) {
      await prisma.notification.createMany({
        data: enrollments.map((e) => ({
          userId: e.studentId,
          type: "ASSIGNMENT_POSTED" as const,
          title: "New Assignment",
          message: `New assignment "${assignment.title}" has been posted`,
          link: `/assignments/${assignment.id}`,
        })),
      });
    }

    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
});

// GET /api/assignments/class/:classId - list assignments for a class
router.get("/class/:classId", async (req, res, next) => {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { subject: { batchId: req.params.classId } },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    // For students, include their submission status
    if (req.user!.role === "STUDENT") {
      const submissions = await prisma.assignmentSubmission.findMany({
        where: { studentId: req.user!.id, assignmentId: { in: assignments.map((a) => a.id) } },
      });
      const subMap = new Map(submissions.map((s) => [s.assignmentId, s]));
      const withStatus = assignments.map((a) => ({ ...a, mySubmission: subMap.get(a.id) ?? null }));
      res.json({ success: true, data: withStatus });
      return;
    }

    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
});

// GET /api/assignments/:id - single assignment
router.get("/:id", async (req, res, next) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true } },
      },
    });
    if (!assignment) throw new AppError("Assignment not found", 404);
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/assignments/:id
router.patch("/:id", requireRole(Role.TEACHER, Role.ADMIN), async (req, res, next) => {
  try {
    const assignment = await prisma.assignment.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/assignments/:id
router.delete("/:id", requireRole(Role.TEACHER, Role.ADMIN), async (req, res, next) => {
  try {
    await prisma.assignment.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Assignment deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /api/assignments/:id/submit - student submits
router.post("/:id/submit", requireRole(Role.STUDENT), upload.single("file"), async (req, res, next) => {
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) throw new AppError("Assignment not found", 404);

    let fileUrl: string | undefined;

    if (req.file) {
      const fileName = `assignments/${req.params.id}/${req.user!.id}/${Date.now()}_${req.file.originalname}`;
      const { error } = await supabase.storage
        .from("submissions")
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

      if (error) throw new AppError("File upload failed", 500);

      const { data: urlData } = supabase.storage.from("submissions").getPublicUrl(fileName);
      fileUrl = urlData.publicUrl;
    }

    const isLate = new Date() > assignment.dueDate;

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user!.id } },
      update: { fileUrl, submittedAt: new Date(), status: isLate ? "LATE" : "SUBMITTED" },
      create: {
        assignmentId: req.params.id,
        studentId: req.user!.id,
        fileUrl,
        submittedAt: new Date(),
        status: isLate ? "LATE" : "SUBMITTED",
      },
    });

    res.json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
});

// GET /api/assignments/:id/submissions - teacher views all submissions
router.get("/:id/submissions", requireRole(Role.TEACHER, Role.ADMIN), async (req, res, next) => {
  try {
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: req.params.id },
      include: { student: { select: { id: true, name: true, email: true } } },
      orderBy: { submittedAt: "desc" },
    });
    res.json({ success: true, data: submissions });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/assignments/:id/grade/:submissionId - grade a submission
router.patch("/:id/grade/:submissionId", requireRole(Role.TEACHER, Role.ADMIN), validate(gradeSubmissionSchema), async (req, res, next) => {
  try {
    const { score, feedback } = req.body as { score: number; feedback?: string };
    const submission = await prisma.assignmentSubmission.update({
      where: { id: req.params.submissionId },
      data: { score, feedback, status: "GRADED" },
      include: { student: { select: { id: true, name: true } } },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: submission.studentId,
        type: "GRADE_PUBLISHED",
        title: "Assignment Graded",
        message: `Your assignment has been graded: ${score} points`,
        link: `/assignments/${req.params.id}`,
      },
    });

    res.json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
});

export default router;
