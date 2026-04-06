import { z } from "zod";

const cuid = () => z.string().cuid();

export const roleSchema = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "DEPARTMENT_HEAD",
  "CLASS_COORDINATOR",
  "TEACHER",
  "STUDENT",
]);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2).max(100),
  role: z.literal("STUDENT").default("STUDENT"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  handle: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Handle must be lowercase letters, numbers and hyphens only")
    .optional(),
  bio: z.string().max(500).optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number")
    .optional(),
  skills: z.array(z.string()).optional(),
  college: z.string().max(200).optional(),
  batch: z.string().max(50).optional(),
  department: z.string().max(200).optional(),
  githubUsername: z.string().max(100).optional(),
  isPublic: z.boolean().optional(),
  socialLinks: z
    .object({
      github: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      twitter: z.string().url().optional(),
      website: z.string().url().optional(),
    })
    .optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(20).transform((value) => value.toUpperCase()),
  description: z.string().max(1000).optional(),
  headId: cuid().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createSectionSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(1).max(20).transform((value) => value.toUpperCase()),
  semester: z.number().int().min(1).max(12),
  academicYear: z.string().min(4).max(20),
  departmentId: cuid(),
  coordinatorId: cuid().optional().nullable(),
});

export const updateSectionSchema = createSectionSchema.partial();

export const createBatchSchema = createSectionSchema.extend({
  year: z.number().int().min(2000).max(2100).optional(),
  teacherId: cuid().optional(),
});

export const enrollStudentsSchema = z.object({
  studentIds: z.array(cuid()).min(1),
});

export const assignBatchCoordinatorsSchema = z.object({
  coordinatorIds: z.array(cuid()),
});

export const teacherAssignmentSchema = z.object({
  teacherId: cuid(),
  subjectId: cuid(),
  sectionId: cuid(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: roleSchema,
  password: z.string().min(8),
  departmentId: cuid().optional(),
  sectionId: cuid().optional(),
  subjectIds: z.array(cuid()).optional(),
  sectionIds: z.array(cuid()).optional(),
});

export const attendanceRecordInputSchema = z.object({
  studentId: cuid(),
  status: z.enum(["PRESENT", "ABSENT", "LATE"]),
});

export const attendanceSessionUpsertSchema = z.object({
  sectionId: cuid(),
  subjectId: cuid(),
  date: z.string().datetime(),
  topic: z.string().max(500).optional(),
  records: z.array(attendanceRecordInputSchema).min(1),
});

export const markAttendanceSchema = attendanceSessionUpsertSchema.extend({
  batchId: cuid().optional(),
});

export const attendanceReportQuerySchema = paginationSchema.extend({
  sectionId: cuid().optional(),
  subjectId: cuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  belowThresholdOnly: z.coerce.boolean().optional(),
});

export const createGradeSchema = z
  .object({
    studentId: cuid(),
    subjectId: cuid(),
    examType: z.enum(["MID", "FINAL", "INTERNAL", "ASSIGNMENT"]),
    marks: z.number().min(0),
    maxMarks: z.number().min(1),
    semester: z.number().int().min(1).max(12),
    remarks: z.string().max(500).optional(),
  })
  .refine((data) => data.marks <= data.maxMarks, {
    message: "marks cannot exceed maxMarks",
    path: ["marks"],
  });

export const bulkCreateGradesSchema = z.object({
  subjectId: cuid(),
  examType: z.enum(["MID", "FINAL", "INTERNAL", "ASSIGNMENT"]),
  maxMarks: z.number().min(1),
  semester: z.number().int().min(1).max(12),
  grades: z.array(
    z.object({
      studentId: cuid(),
      marks: z.number().min(0),
      remarks: z.string().max(500).optional(),
    })
  ),
})
  .refine(
    (data) => data.grades.every((g) => g.marks <= data.maxMarks),
    (data) => ({
      message: `One or more marks exceed the maximum of ${data.maxMarks}`,
      path: ["grades"],
    })
  );

// Schema for subject result components (mid-term, end-term, assignment, TC)
export const subjectResultComponentSchema = z
  .object({
    studentId: cuid(),
    subjectId: cuid(),
    semester: z.number().int().min(1).max(12),
    midTerm: z.number().min(0).optional(),
    endTerm: z.number().min(0).optional(),
    assignment: z.number().min(0).optional(),
    tc: z.number().min(0).optional(),
    remarks: z.string().max(500).optional(),
    // Config passed from client to validate against (server still validates against DB config)
    config: z
      .object({
        maxMidTerm: z.number().min(0).optional(),
        maxEndTerm: z.number().min(0).optional(),
        maxAssignment: z.number().min(0).optional(),
        maxTC: z.number().min(0).optional(),
      })
      .optional(),
  });

export const bulkResultImportSchema = z.object({
  subjectId: cuid(),
  semester: z.number().int().min(1).max(12),
  rows: z.array(
    z.object({
      studentId: cuid(),
      midTerm: z.number().min(0).optional(),
      endTerm: z.number().min(0).optional(),
      assignment: z.number().min(0).optional(),
      tc: z.number().min(0).optional(),
      remarks: z.string().max(500).optional(),
    })
  ),
});

export const createAssignmentSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  subjectId: cuid(),
  dueDate: z.string().datetime(),
  maxScore: z.number().min(1).max(1000),
  targetStudentIds: z.array(cuid()).optional().default([]),
});

export const gradeSubmissionSchema = z.object({
  score: z.number().min(0),
  feedback: z.string().max(1000).optional(),
});

export const createProblemSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens only"),
  description: z.string().min(10),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  tags: z.array(z.string()).max(10).default([]),
  scope: z.enum(["GLOBAL", "DEPARTMENT", "SECTION"]).optional().default("GLOBAL"),
  scopeDepartmentId: cuid().optional().nullable(),
  scopeSectionId: cuid().optional().nullable(),
  tagIds: z.array(cuid()).optional().default([]),
  constraints: z.string().optional(),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
  sampleInput: z.string().optional(),
  sampleOutput: z.string().optional(),
  functionName: z.string().min(1).optional(),
  parameterNames: z.array(z.string().min(1)).optional().default([]),
  parameterTypes: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
      })
    )
    .optional(),
  returnType: z.string().min(1).optional(),
  starterCode: z.record(z.string(), z.string()).optional(),
  boilerplates: z
    .array(
      z.object({
        language: z.string().min(1).max(50),
        code: z.string().min(1),
      })
    )
    .optional()
    .default([]),
  hints: z
    .array(
      z.object({
        tier: z.number().int().min(1).optional().default(1),
        content: z.string().min(1),
      })
    )
    .optional()
    .default([]),
  editorial: z
    .object({
      summary: z.string().optional(),
      approach: z.string().optional(),
      complexity: z.string().optional(),
      fullEditorial: z.string().min(1),
    })
    .optional(),
  compareMode: z
    .enum(["EXACT", "UNORDERED", "FLOAT_TOLERANCE", "IGNORE_TRAILING_WHITESPACE"])
    .optional()
    .default("IGNORE_TRAILING_WHITESPACE"),
  timeLimitMs: z.number().int().min(100).max(30000).optional().default(2000),
  memoryLimitKb: z.number().int().min(16384).max(1048576).optional().default(262144),
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

export const executeRunSchema = z.object({
  problemId: cuid(),
  code: z.string().min(1).max(65536),
  language: z.string().min(1),
  customInput: z.string().optional(),
});

export const executeSubmitSchema = z.object({
  problemId: cuid(),
  code: z.string().min(1).max(65536),
  language: z.string().min(1),
  contestId: cuid().optional(),
});

export const createContestSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(10),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    registrationEnd: z.string().datetime().optional().nullable(),
    freezeTime: z.string().datetime().optional().nullable(),
    type: z.enum(["PUBLIC", "PRIVATE", "INSTITUTIONAL", "SUBJECT", "DEPARTMENT", "INSTITUTION"]).default("PUBLIC"),
    scope: z.enum(["GLOBAL", "DEPARTMENT", "SECTION"]).default("GLOBAL"),
    rules: z.string().optional(),
    penaltyMinutes: z.number().int().min(0).max(120).optional(),
    allowLateJoin: z.boolean().optional(),
    aiDisabled: z.boolean().optional(),
    xpReward: z.number().int().min(0).optional(),
    problemIds: z.array(cuid()).min(1),
    departmentId: cuid().optional().nullable(),
    subjectId: cuid().optional().nullable(),
    sectionId: cuid().optional().nullable(),
    participantIds: z.array(cuid()).optional().default([]),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "End time must be after start time",
    path: ["endTime"],
  })
  .refine((data) => !data.registrationEnd || new Date(data.registrationEnd) <= new Date(data.startTime), {
    message: "Registration end must be on or before start time",
    path: ["registrationEnd"],
  })
  .refine((data) => !data.freezeTime || new Date(data.freezeTime) <= new Date(data.endTime), {
    message: "Freeze time must be on or before end time",
    path: ["freezeTime"],
  })
  .refine((data) => {
    if (data.scope === "GLOBAL") {
      return !data.departmentId && !data.sectionId && !data.subjectId;
    }
    if (data.scope === "DEPARTMENT") {
      return !!data.departmentId && !data.sectionId;
    }
    return !!data.sectionId;
  }, {
    message: "Contest scope requires matching department/section fields",
    path: ["scope"],
  });

export const addContestProblemSchema = z.object({
  problemId: cuid(),
  order: z.number().int().min(1),
  points: z.number().int().min(1),
});

export const createSubjectSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(20).transform((value) => value.toUpperCase()),
  sectionId: cuid(),
  departmentId: cuid(),
  teacherId: cuid().optional().nullable(),
});

export const updateStudentProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  phoneNumber: z.string().max(30).optional().nullable(),
  leetcodeUsername: z.string().max(100).optional().nullable(),
  githubUsername: z.string().max(100).optional().nullable(),
  codechefUsername: z.string().max(100).optional().nullable(),
  codeforcesUsername: z.string().max(100).optional().nullable(),
  hackerrankUsername: z.string().max(100).optional().nullable(),
  cgpa: z.number().min(0).max(10).optional().nullable(),
  isPublic: z.boolean().optional(),
});

export const hackathonWinnerEntryInputSchema = z.object({
  rank: z.number().int().min(1).max(3),
  teamName: z.string().min(1).max(120),
  projectTitle: z.string().max(200).optional().nullable(),
  submissionUrl: z.string().url().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  memberSnapshot: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        email: z.string().email().optional().nullable(),
        phoneNumber: z.string().max(30).optional().nullable(),
        avatar: z.string().url().optional().nullable(),
      })
    )
    .min(1)
    .max(10),
});

export const upsertHackathonWinnersSchema = z.object({
  winners: z.array(hackathonWinnerEntryInputSchema).max(3),
});

export const skillInputSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]).default("BEGINNER"),
});

export const projectInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  techStack: z.array(z.string().min(1)).max(20).default([]),
  githubUrl: z.string().url().optional().nullable(),
  liveUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  featured: z.boolean().optional(),
});

export const achievementInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  date: z.string().datetime(),
  category: z.string().min(1).max(100),
  certificateUrl: z.string().url().optional().nullable(),
});

export const profileSyncSchema = z.object({
  platform: z.enum(["leetcode", "github", "codechef", "codeforces", "all"]).default("all"),
});

const hackathonSchemaBase = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  departmentId: cuid().optional().nullable(),
  minSkills: z.array(z.string()).default([]),
  minProjects: z.number().int().min(0).default(0),
  minLeetcode: z.number().int().min(0).default(0),
  minCgpa: z.number().min(0).max(10).optional().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  registrationDeadline: z.string().datetime(),
  maxTeamSize: z.number().int().min(1).max(20).default(4),
  minTeamSize: z.number().int().min(1).max(20).default(1),
  prizeDetails: z.string().max(1000).optional().nullable(),
  participantIds: z.array(cuid()).optional().default([]),
  status: z
    .enum(["DRAFT", "UPCOMING", "REGISTRATION_OPEN", "ONGOING", "COMPLETED", "CANCELLED"])
    .default("UPCOMING"),
});

export const createHackathonSchema = hackathonSchemaBase
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  })
  .refine((data) => new Date(data.registrationDeadline) <= new Date(data.startDate), {
    message: "Registration deadline must be on or before the start date",
    path: ["registrationDeadline"],
  })
  .refine((data) => data.maxTeamSize >= data.minTeamSize, {
    message: "Max team size must be at least min team size",
    path: ["maxTeamSize"],
  });

export const updateHackathonSchema = hackathonSchemaBase.partial();

export const createHackathonTeamSchema = z.object({
  name: z.string().min(2).max(100),
  memberUserIds: z.array(cuid()).max(10).default([]),
});

export const updateHackathonTeamSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  submissionUrl: z.string().url().optional().nullable(),
  memberUserIds: z.array(cuid()).max(10).optional(),
});

export const notificationSendSchema = z.object({
  type: z.enum([
    "ASSIGNMENT_POSTED",
    "ASSIGNMENT_GRADED",
    "GRADE_PUBLISHED",
    "CONTEST_CREATED",
    "CONTEST_STARTING",
    "CONTEST_STARTING_SOON",
    "CONTEST_ENDED",
    "HACKATHON_CREATED",
    "HACKATHON_REGISTRATION_OPEN",
    "HACKATHON_DEADLINE_APPROACHING",
    "COMPETITION_CREATED",
    "SUBMISSION_JUDGED",
    "SUBMISSION_ACCEPTED",
    "ENROLLMENT_ADDED",
    "LEADERBOARD_UPDATED",
    "ATTENDANCE_LOW",
    "ANNOUNCEMENT",
    "GENERAL",
  ]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  targetSectionId: cuid().optional(),
  targetDepartmentId: cuid().optional(),
  targetRole: roleSchema.optional(),
  entityId: z.string().max(100).optional(),
  entityType: z.string().max(50).optional(),
  link: z.string().max(500).optional(),
});

export const leaderboardQuerySchema = paginationSchema.extend({
  filter: z.enum(["overall", "coding", "academic", "profile", "external"]).default("overall"),
  search: z.string().max(100).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
});

export const hackathonListQuerySchema = paginationSchema.extend({
  status: z
    .enum(["DRAFT", "UPCOMING", "REGISTRATION_OPEN", "ONGOING", "COMPLETED", "CANCELLED"])
    .optional(),
  departmentId: cuid().optional(),
});

export { z };
