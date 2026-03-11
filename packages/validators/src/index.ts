import { z } from "zod";

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]).default("STUDENT"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// ─────────────────────────────────────────────
// USER / PROFILE
// ─────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  skills: z.array(z.string()).optional(),
  college: z.string().max(200).optional(),
  batch: z.string().max(50).optional(),
  department: z.string().max(200).optional(),
  githubUsername: z.string().max(100).optional(),
  socialLinks: z
    .object({
      github: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      twitter: z.string().url().optional(),
      website: z.string().url().optional(),
    })
    .optional(),
});

// ─────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(20).toUpperCase(),
  headId: z.string().cuid().optional(),
});

export const createBatchSchema = z.object({
  name: z.string().min(2).max(200),
  year: z.number().int().min(2000).max(2100),
  semester: z.number().int().min(1).max(10),
  departmentId: z.string().cuid(),
  teacherId: z.string().cuid(),
});

export const enrollStudentsSchema = z.object({
  studentIds: z.array(z.string().cuid()).min(1),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
  password: z.string().min(8),
  departmentId: z.string().cuid().optional(),
});

// ─────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────

export const markAttendanceSchema = z.object({
  batchId: z.string().cuid(),
  subjectId: z.string().cuid(),
  date: z.string().datetime(),
  records: z.array(
    z.object({
      studentId: z.string().cuid(),
      status: z.enum(["PRESENT", "ABSENT", "LATE"]),
    })
  ),
});

// ─────────────────────────────────────────────
// GRADES
// ─────────────────────────────────────────────

export const createGradeSchema = z.object({
  studentId: z.string().cuid(),
  subjectId: z.string().cuid(),
  examType: z.enum(["MID", "FINAL", "INTERNAL", "ASSIGNMENT"]),
  marks: z.number().min(0),
  maxMarks: z.number().min(1),
  semester: z.number().int().min(1).max(10),
  remarks: z.string().max(500).optional(),
});

export const bulkCreateGradesSchema = z.object({
  subjectId: z.string().cuid(),
  examType: z.enum(["MID", "FINAL", "INTERNAL", "ASSIGNMENT"]),
  maxMarks: z.number().min(1),
  semester: z.number().int().min(1).max(10),
  grades: z.array(
    z.object({
      studentId: z.string().cuid(),
      marks: z.number().min(0),
      remarks: z.string().max(500).optional(),
    })
  ),
});

// ─────────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────────

export const createAssignmentSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  subjectId: z.string().cuid(),
  dueDate: z.string().datetime(),
  maxScore: z.number().min(1).max(1000),
});

export const gradeSubmissionSchema = z.object({
  score: z.number().min(0),
  feedback: z.string().max(1000).optional(),
});

// ─────────────────────────────────────────────
// PROBLEMS
// ─────────────────────────────────────────────

export const createProblemSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens only"),
  description: z.string().min(10),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  tags: z.array(z.string()).min(1).max(10),
  constraints: z.string().optional(),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
  sampleInput: z.string().optional(),
  sampleOutput: z.string().optional(),
  points: z.number().int().min(1),
  isPublished: z.boolean().default(false),
});

export const createTestCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isSample: z.boolean().default(false),
  isHidden: z.boolean().default(false),
});

export const bulkCreateTestCasesSchema = z.object({
  testCases: z.array(createTestCaseSchema).min(1),
});

// ─────────────────────────────────────────────
// CODE EXECUTION
// ─────────────────────────────────────────────

export const executeRunSchema = z.object({
  problemId: z.string().cuid(),
  code: z.string().min(1).max(65536),
  language: z.string().min(1),
  customInput: z.string().optional(),
});

export const executeSubmitSchema = z.object({
  problemId: z.string().cuid(),
  code: z.string().min(1).max(65536),
  language: z.string().min(1),
  contestId: z.string().cuid().optional(),
});

// ─────────────────────────────────────────────
// CONTESTS
// ─────────────────────────────────────────────

export const createContestSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  type: z.enum(["PUBLIC", "PRIVATE", "INSTITUTIONAL"]).default("PUBLIC"),
  rules: z.string().optional(),
  problemIds: z.array(z.string().cuid()).min(1),
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be after start time",
  path: ["endTime"],
});

export const addContestProblemSchema = z.object({
  problemId: z.string().cuid(),
  order: z.number().int().min(1),
  points: z.number().int().min(1),
});

// ─────────────────────────────────────────────
// SUBJECTS
// ─────────────────────────────────────────────

export const createSubjectSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(20),
  batchId: z.string().cuid(),
  departmentId: z.string().cuid(),
});

// ─────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Export zod for convenience
export { z };
