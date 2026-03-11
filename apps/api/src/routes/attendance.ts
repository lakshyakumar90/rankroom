import { Router } from "express";
import { prisma } from "@repo/database";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import { markAttendanceSchema } from "@repo/validators";
import { Role } from "@repo/types";

const router = Router();
router.use(authenticate);

// POST /api/attendance - teacher marks attendance
router.post(
  "/",
  requireRole(Role.TEACHER, Role.ADMIN),
  validate(markAttendanceSchema),
  async (req, res, next) => {
    try {
      const { batchId, subjectId, date, records } = req.body as {
        batchId: string;
        subjectId: string;
        date: string;
        records: { studentId: string; status: "PRESENT" | "ABSENT" | "LATE" }[];
      };

      const attendance = await prisma.attendance.upsert({
        where: { date_batchId_subjectId: { date: new Date(date), batchId, subjectId } },
        update: { teacherId: req.user!.id },
        create: { date: new Date(date), batchId, subjectId, teacherId: req.user!.id },
      });

      // Upsert all records
      await prisma.$transaction(
        records.map((r) =>
          prisma.attendanceRecord.upsert({
            where: { attendanceId_studentId: { attendanceId: attendance.id, studentId: r.studentId } },
            update: { status: r.status },
            create: { attendanceId: attendance.id, studentId: r.studentId, status: r.status },
          })
        )
      );

      const full = await prisma.attendance.findUnique({
        where: { id: attendance.id },
        include: { records: { include: { student: { select: { id: true, name: true } } } } },
      });

      res.json({ success: true, data: full });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/attendance/:classId - by date range
router.get("/:classId", async (req, res, next) => {
  try {
    const { from, to, subjectId } = req.query as { from?: string; to?: string; subjectId?: string };

    const attendance = await prisma.attendance.findMany({
      where: {
        batchId: req.params.classId,
        ...(subjectId ? { subjectId } : {}),
        ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      include: {
        records: { include: { student: { select: { id: true, name: true } } } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    res.json({ success: true, data: attendance });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/student/:id - student's own attendance
router.get("/student/:id", async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Only allow student to see their own, or teacher/admin to see any
    if (req.user!.role === "STUDENT" && req.user!.id !== studentId) {
      throw new AppError("Forbidden", 403);
    }

    const records = await prisma.attendanceRecord.findMany({
      where: { studentId },
      include: {
        attendance: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            batch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { attendance: { date: "desc" } },
    });

    // Calculate summary per subject
    const subjectMap = new Map<string, { subjectName: string; present: number; absent: number; late: number; total: number }>();
    for (const record of records) {
      const key = record.attendance.subjectId;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, { subjectName: record.attendance.subject.name, present: 0, absent: 0, late: 0, total: 0 });
      }
      const summary = subjectMap.get(key)!;
      summary.total++;
      if (record.status === "PRESENT") summary.present++;
      else if (record.status === "ABSENT") summary.absent++;
      else summary.late++;
    }

    res.json({ success: true, data: { records, summary: Object.fromEntries(subjectMap) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/:classId/report - class report
router.get("/:classId/report", requireRole(Role.TEACHER, Role.ADMIN), async (req, res, next) => {
  try {
    const { subjectId } = req.query as { subjectId?: string };

    const records = await prisma.attendanceRecord.findMany({
      where: {
        attendance: {
          batchId: req.params.classId,
          ...(subjectId ? { subjectId } : {}),
        },
      },
      include: {
        student: { select: { id: true, name: true } },
        attendance: { select: { date: true, subjectId: true } },
      },
    });

    // Calculate per-student summary
    const studentMap = new Map<string, { name: string; present: number; absent: number; late: number; total: number }>();
    for (const r of records) {
      const key = r.studentId;
      if (!studentMap.has(key)) studentMap.set(key, { name: r.student.name, present: 0, absent: 0, late: 0, total: 0 });
      const s = studentMap.get(key)!;
      s.total++;
      if (r.status === "PRESENT") s.present++;
      else if (r.status === "ABSENT") s.absent++;
      else s.late++;
    }

    const report = Array.from(studentMap.entries()).map(([id, stats]) => ({
      studentId: id,
      ...stats,
      percentage: Math.round(((stats.present + stats.late) / stats.total) * 100) || 0,
    }));

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

export default router;
