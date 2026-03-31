import { prisma } from "@repo/database";
import { AppError } from "../middleware/error";

export async function createOrUpdateAttendanceSession(
  sessionId: string | null,
  userId: string,
  payload: {
    sectionId: string;
    subjectId: string;
    date: string;
    topic?: string;
    records: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "LATE" }>;
  }
) {
  const enrollments = await prisma.enrollment.findMany({
    where: { sectionId: payload.sectionId },
    select: { studentId: true },
  });
  const validStudentIds = new Set(enrollments.map((enrollment) => enrollment.studentId));

  const invalidStudent = payload.records.find((record) => !validStudentIds.has(record.studentId));
  if (invalidStudent) {
    throw new AppError("Attendance records contain a student outside the selected section", 400);
  }

  const targetDate = new Date(payload.date);
  const session =
    sessionId === null
      ? await prisma.attendanceSession.upsert({
          where: {
            sectionId_subjectId_date: {
              sectionId: payload.sectionId,
              subjectId: payload.subjectId,
              date: targetDate,
            },
          },
          update: {
            takenById: userId,
            topic: payload.topic,
          },
          create: {
            sectionId: payload.sectionId,
            subjectId: payload.subjectId,
            takenById: userId,
            date: targetDate,
            topic: payload.topic,
          },
        })
      : await prisma.attendanceSession.update({
          where: { id: sessionId },
          data: {
            takenById: userId,
            topic: payload.topic,
          },
        });

  await prisma.$transaction([
    prisma.attendanceRecord.deleteMany({ where: { attendanceSessionId: session.id } }),
    prisma.attendanceRecord.createMany({
      data: payload.records.map((record) => ({
        attendanceSessionId: session.id,
        studentId: record.studentId,
        status: record.status,
      })),
    }),
  ]);

  return prisma.attendanceSession.findUnique({
    where: { id: session.id },
    include: {
      section: true,
      subject: true,
      takenBy: {
        select: { id: true, name: true, email: true, role: true, avatar: true },
      },
      records: {
        include: {
          student: {
            select: { id: true, name: true, email: true, role: true, avatar: true },
          },
        },
        orderBy: { student: { name: "asc" } },
      },
    },
  });
}

export async function getAttendanceSession(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      section: true,
      subject: true,
      takenBy: {
        select: { id: true, name: true, email: true, role: true, avatar: true },
      },
      records: {
        include: {
          student: {
            select: { id: true, name: true, email: true, role: true, avatar: true },
          },
        },
        orderBy: { student: { name: "asc" } },
      },
    },
  });

  if (!session) throw new AppError("Attendance session not found", 404);
  return session;
}

export async function getStudentAttendance(studentId: string) {
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId },
    include: {
      attendanceSession: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          section: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { attendanceSession: { date: "desc" } },
  });

  const summary = new Map<string, { subjectId: string; subjectName: string; present: number; absent: number; late: number; total: number }>();

  for (const record of records) {
    const key = record.attendanceSession.subjectId;
    if (!summary.has(key)) {
      summary.set(key, {
        subjectId: key,
        subjectName: record.attendanceSession.subject.name,
        present: 0,
        absent: 0,
        late: 0,
        total: 0,
      });
    }

    const bucket = summary.get(key)!;
    bucket.total += 1;
    if (record.status === "PRESENT") bucket.present += 1;
    else if (record.status === "ABSENT") bucket.absent += 1;
    else bucket.late += 1;
  }

  return {
    records,
    summary: Array.from(summary.values()).map((row) => ({
      ...row,
      percentage: row.total === 0 ? 0 : Math.round(((row.present + row.late) / row.total) * 100),
    })),
  };
}

export async function getSectionSubjectSummary(sectionId: string, subjectId: string) {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      attendanceSession: {
        sectionId,
        subjectId,
      },
    },
    include: {
      student: { select: { id: true, name: true, email: true, avatar: true } },
      attendanceSession: { select: { date: true } },
    },
  });

  const studentSummary = new Map<string, { studentId: string; studentName: string; present: number; absent: number; late: number; total: number }>();
  for (const record of records) {
    if (!studentSummary.has(record.studentId)) {
      studentSummary.set(record.studentId, {
        studentId: record.studentId,
        studentName: record.student.name,
        present: 0,
        absent: 0,
        late: 0,
        total: 0,
      });
    }

    const row = studentSummary.get(record.studentId)!;
    row.total += 1;
    if (record.status === "PRESENT") row.present += 1;
    else if (record.status === "ABSENT") row.absent += 1;
    else row.late += 1;
  }

  return Array.from(studentSummary.values()).map((row) => ({
    ...row,
    percentage: row.total === 0 ? 0 : Math.round(((row.present + row.late) / row.total) * 100),
  }));
}

export async function getLowAttendance(sectionId: string) {
  const subjects = await prisma.subject.findMany({
    where: { sectionId },
    select: { id: true, name: true, code: true },
  });

  const results = await Promise.all(
    subjects.map(async (subject) => {
      const summary = await getSectionSubjectSummary(sectionId, subject.id);
      return summary
        .filter((row) => row.percentage < 75)
        .map((row) => ({
          ...row,
          subject,
        }));
    })
  );

  return results.flat();
}
