import { prisma } from "@repo/database";
import { AppError } from "../middleware/error";

interface ResultComponents {
  midTerm?: number;
  endTerm?: number;
  assignment?: number;
  tc?: number;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string; value: number; max: number }>;
  total: number;
  totalMax: number;
  percentage: number;
}

// ─── Get or create config for a subject ──────────────────────────────────────

export async function getSubjectResultConfig(subjectId: string) {
  const config = await prisma.subjectResultConfig.findUnique({ where: { subjectId } });
  if (config) return config;

  // Return defaults without creating
  return { maxMidTerm: 25, maxEndTerm: 50, maxAssignment: 15, maxTC: 10, credits: null };
}

// ─── Validate component marks against config ──────────────────────────────────

export async function validateResultComponents(
  subjectId: string,
  components: ResultComponents
): Promise<ValidationResult> {
  const config = await getSubjectResultConfig(subjectId);
  const errors: ValidationResult["errors"] = [];

  const checks: Array<[keyof ResultComponents, number]> = [
    ["midTerm", config.maxMidTerm],
    ["endTerm", config.maxEndTerm],
    ["assignment", config.maxAssignment],
    ["tc", config.maxTC],
  ];

  for (const [field, max] of checks) {
    const value = components[field];
    if (value !== undefined && value !== null) {
      if (value < 0) {
        errors.push({ field, message: `${field} cannot be negative`, value, max });
      } else if (value > max) {
        errors.push({ field, message: `${field} (${value}) exceeds maximum of ${max}`, value, max });
      }
    }
  }

  const totalMax = config.maxMidTerm + config.maxEndTerm + config.maxAssignment + config.maxTC;
  const total =
    (components.midTerm ?? 0) +
    (components.endTerm ?? 0) +
    (components.assignment ?? 0) +
    (components.tc ?? 0);
  const percentage = totalMax > 0 ? (total / totalMax) * 100 : 0;

  return { valid: errors.length === 0, errors, total, totalMax, percentage };
}

// ─── Upsert result for a student in a subject ─────────────────────────────────

export async function upsertStudentResult({
  studentId,
  subjectId,
  teacherId,
  semester,
  components,
}: {
  studentId: string;
  subjectId: string;
  teacherId: string;
  semester: number;
  components: ResultComponents;
}) {
  // Validate student is enrolled in the subject's section
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { sectionId: true },
  });
  if (!subject) throw new AppError("Subject not found", 404);

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, sectionId: subject.sectionId },
  });
  if (!enrollment) throw new AppError("Student is not enrolled in this subject's section", 400);

  // Validate marks against config
  const validation = await validateResultComponents(subjectId, components);
  if (!validation.valid) {
    throw new AppError(
      `Marks validation failed: ${validation.errors.map((e) => e.message).join("; ")}`,
      400
    );
  }

  // Upsert each component as a Grade row
  const examTypeMap: Array<[keyof ResultComponents, "MID" | "FINAL" | "ASSIGNMENT" | "INTERNAL"]> = [
    ["midTerm", "MID"],
    ["endTerm", "FINAL"],
    ["assignment", "ASSIGNMENT"],
    ["tc", "INTERNAL"],
  ];
  const config = await getSubjectResultConfig(subjectId);
  const maxMap: Record<string, number> = {
    midTerm: config.maxMidTerm,
    endTerm: config.maxEndTerm,
    assignment: config.maxAssignment,
    tc: config.maxTC,
  };

  const results = [];
  for (const [field, examType] of examTypeMap) {
    const marks = components[field];
    if (marks === undefined || marks === null) continue;

    const grade = await prisma.grade.upsert({
      where: {
        // Custom unique index not yet set up — use findFirst + update/create
        // Falls back to create with unique check inline
        id: "placeholder_will_not_match",
      },
      update: {},
      create: {} as never,
    }).catch(() => null);

    // Use findFirst + conditional upsert pattern since Grade doesn't have
    // a unique compound key on (studentId, subjectId, semester, examType) yet
    const existing = await prisma.grade.findFirst({
      where: { studentId, subjectId, semester, examType },
    });

    const saved = existing
      ? await prisma.grade.update({
          where: { id: existing.id },
          data: { marks, maxMarks: maxMap[field]!, teacherId },
        })
      : await prisma.grade.create({
          data: {
            studentId,
            subjectId,
            teacherId,
            examType,
            marks,
            maxMarks: maxMap[field]!,
            semester,
          },
        });

    results.push(saved);
  }

  return {
    results,
    summary: {
      total: validation.total,
      totalMax: validation.totalMax,
      percentage: Number(validation.percentage.toFixed(2)),
    },
  };
}

// ─── Bulk import with row-level validation errors ─────────────────────────────

export async function bulkUpsertResults({
  subjectId,
  teacherId,
  semester,
  rows,
}: {
  subjectId: string;
  teacherId: string;
  semester: number;
  rows: Array<{ studentId: string } & ResultComponents>;
}) {
  const config = await getSubjectResultConfig(subjectId);
  const rowErrors: Array<{ studentId: string; errors: ValidationResult["errors"] }> = [];
  const saved = [];

  for (const row of rows) {
    const { studentId, ...components } = row;
    const validation = await validateResultComponents(subjectId, components);
    if (!validation.valid) {
      rowErrors.push({ studentId, errors: validation.errors });
      continue;
    }
    try {
      const result = await upsertStudentResult({ studentId, subjectId, teacherId, semester, components });
      saved.push({ studentId, ...result.summary });
    } catch {
      rowErrors.push({ studentId, errors: [{ field: "general", message: "Save failed", value: 0, max: 0 }] });
    }
  }

  return {
    savedCount: saved.length,
    errorCount: rowErrors.length,
    rowErrors,
    config: {
      maxMidTerm: config.maxMidTerm,
      maxEndTerm: config.maxEndTerm,
      maxAssignment: config.maxAssignment,
      maxTC: config.maxTC,
      totalMax: config.maxMidTerm + config.maxEndTerm + config.maxAssignment + config.maxTC,
    },
  };
}
