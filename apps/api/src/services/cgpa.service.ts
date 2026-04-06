import { prisma } from "@repo/database";

const EXAM_TYPE_MAX_MARKS: Record<string, number> = {
  MID: 25,
  FINAL: 50,
  ASSIGNMENT: 15,
  INTERNAL: 10,
};

type PrismaCgpaClient = Pick<typeof prisma, "grade" | "studentProfile">;

export interface StudentCgpaBreakdownItem {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  cgpaPoints: number;
}

export interface StudentCgpaResult {
  cgpa: number;
  subjectBreakdown: StudentCgpaBreakdownItem[];
  totalSubjects: number;
}

export async function calculateStudentCgpa(
  studentId: string,
  db: PrismaCgpaClient = prisma
): Promise<StudentCgpaResult> {
  const grades = await db.grade.findMany({
    where: { studentId },
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: { createdAt: "desc" },
  });

  const subjectMap = new Map<string, { name: string; code: string; totalObtained: number; totalMax: number }>();

  for (const grade of grades) {
    if (!subjectMap.has(grade.subjectId)) {
      subjectMap.set(grade.subjectId, {
        name: grade.subject.name,
        code: grade.subject.code,
        totalObtained: 0,
        totalMax: 0,
      });
    }

    const subjectEntry = subjectMap.get(grade.subjectId)!;
    const expectedMaxMarks = EXAM_TYPE_MAX_MARKS[grade.examType] ?? grade.maxMarks;

    if (grade.maxMarks <= 0 || expectedMaxMarks <= 0) {
      continue;
    }

    const normalizedMarks = (grade.marks / grade.maxMarks) * expectedMaxMarks;
    subjectEntry.totalObtained += normalizedMarks;
    subjectEntry.totalMax += expectedMaxMarks;
  }

  const subjectBreakdown: StudentCgpaBreakdownItem[] = Array.from(subjectMap.entries()).map(([subjectId, data]) => ({
    subjectId,
    subjectName: data.name,
    subjectCode: data.code,
    totalObtained: Math.round(data.totalObtained * 10) / 10,
    totalMax: data.totalMax,
    percentage: data.totalMax > 0 ? Math.round((data.totalObtained / data.totalMax) * 1000) / 10 : 0,
    cgpaPoints: data.totalMax > 0 ? Math.round((data.totalObtained / data.totalMax) * 100) / 10 : 0,
  }));

  const cgpa =
    subjectBreakdown.length > 0
      ? Math.round((subjectBreakdown.reduce((sum, item) => sum + item.cgpaPoints, 0) / subjectBreakdown.length) * 100) /
        100
      : 0;

  return {
    cgpa,
    subjectBreakdown,
    totalSubjects: subjectBreakdown.length,
  };
}

export async function syncStudentProfileCgpa(
  studentId: string,
  db: PrismaCgpaClient = prisma
): Promise<number | null> {
  const cgpaResult = await calculateStudentCgpa(studentId, db);

  await db.studentProfile.upsert({
    where: { userId: studentId },
    update: { cgpa: cgpaResult.totalSubjects > 0 ? cgpaResult.cgpa : null },
    create: {
      userId: studentId,
      cgpa: cgpaResult.totalSubjects > 0 ? cgpaResult.cgpa : null,
    },
  });

  return cgpaResult.totalSubjects > 0 ? cgpaResult.cgpa : null;
}