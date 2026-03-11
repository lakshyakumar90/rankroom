// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export enum Role {
  ADMIN = "ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
}

export enum AttendanceStatus {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
  LATE = "LATE",
}

export enum ExamType {
  MID = "MID",
  FINAL = "FINAL",
  INTERNAL = "INTERNAL",
  ASSIGNMENT = "ASSIGNMENT",
}

export enum SubmissionStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  WRONG_ANSWER = "WRONG_ANSWER",
  TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED",
  MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED",
  COMPILATION_ERROR = "COMPILATION_ERROR",
  RUNTIME_ERROR = "RUNTIME_ERROR",
}

export enum AssignmentSubmissionStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  GRADED = "GRADED",
  LATE = "LATE",
}

export enum Difficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

export enum ContestType {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
  INSTITUTIONAL = "INSTITUTIONAL",
}

export enum ContestStatus {
  UPCOMING = "UPCOMING",
  LIVE = "LIVE",
  ENDED = "ENDED",
}

export enum NotificationType {
  ASSIGNMENT_POSTED = "ASSIGNMENT_POSTED",
  GRADE_PUBLISHED = "GRADE_PUBLISHED",
  CONTEST_STARTING = "CONTEST_STARTING",
  SUBMISSION_JUDGED = "SUBMISSION_JUDGED",
  ENROLLMENT_ADDED = "ENROLLMENT_ADDED",
  GENERAL = "GENERAL",
}

// ─────────────────────────────────────────────
// API RESPONSE WRAPPER
// ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─────────────────────────────────────────────
// ENTITY TYPES
// ─────────────────────────────────────────────

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string | null;
  githubUsername?: string | null;
  createdAt: string;
}

export interface ProfilePublic {
  userId: string;
  bio?: string | null;
  skills: string[];
  socialLinks?: Record<string, string> | null;
  college?: string | null;
  batch?: string | null;
  department?: string | null;
  totalPoints: number;
  rank?: number | null;
  streak: number;
}

export interface UserWithProfile extends UserPublic {
  profile?: ProfilePublic | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headId?: string | null;
  createdAt: string;
}

export interface Batch {
  id: string;
  name: string;
  year: number;
  semester: number;
  departmentId: string;
  teacherId: string;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  batchId: string;
  departmentId: string;
  teacherId: string;
}

export interface AttendanceRecord {
  id: string;
  attendanceId: string;
  studentId: string;
  status: AttendanceStatus;
}

export interface AttendanceSummary {
  classId: string;
  date: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  teacherId: string;
  examType: ExamType;
  marks: number;
  maxMarks: number;
  semester: number;
  remarks?: string | null;
  createdAt: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  teacherId: string;
  dueDate: string;
  maxScore: number;
  attachmentUrl?: string | null;
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt?: string | null;
  fileUrl?: string | null;
  score?: number | null;
  feedback?: string | null;
  status: AssignmentSubmissionStatus;
}

// ─────────────────────────────────────────────
// CODING PLATFORM TYPES
// ─────────────────────────────────────────────

export interface Problem {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  tags: string[];
  constraints?: string | null;
  inputFormat?: string | null;
  outputFormat?: string | null;
  sampleInput?: string | null;
  sampleOutput?: string | null;
  createdById: string;
  isPublished: boolean;
  points: number;
  createdAt: string;
}

export interface TestCase {
  id: string;
  problemId: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  isHidden: boolean;
}

export interface Submission {
  id: string;
  userId: string;
  problemId: string;
  contestId?: string | null;
  code: string;
  language: string;
  status: SubmissionStatus;
  runtime?: number | null;
  memory?: number | null;
  verdict?: SubmissionVerdict[] | null;
  createdAt: string;
}

export interface SubmissionVerdict {
  testCaseIndex: number;
  status: string;
  stdout?: string;
  stderr?: string;
  runtime?: number;
  memory?: number;
}

export interface Contest {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  type: ContestType;
  status: ContestStatus;
  createdById: string;
  rules?: string | null;
  createdAt: string;
}

export interface ContestStanding {
  contestId: string;
  userId: string;
  totalScore: number;
  penalty: number;
  rank?: number | null;
  solvedCount: number;
  lastSubmitTime?: string | null;
  user: UserPublic;
}

export interface LeaderboardEntry {
  userId: string;
  totalPoints: number;
  problemsSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestsParticipated: number;
  rank?: number | null;
  user: UserPublic;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────
// REQUEST/RESPONSE DTOs
// ─────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface ProblemFilters extends PaginationQuery {
  difficulty?: Difficulty;
  tag?: string;
  search?: string;
  status?: "solved" | "unsolved" | "attempted";
}

export interface ContestFilters extends PaginationQuery {
  status?: ContestStatus;
  type?: ContestType;
}

export interface ExecuteRunRequest {
  problemId: string;
  code: string;
  language: string;
  customInput?: string;
}

export interface ExecuteSubmitRequest {
  problemId: string;
  code: string;
  language: string;
  contestId?: string;
}

export interface ExecuteRunResponse {
  stdout?: string;
  stderr?: string;
  status: string;
  runtime?: number;
  memory?: number;
}

// ─────────────────────────────────────────────
// SOCKET.IO EVENTS
// ─────────────────────────────────────────────

export interface SocketEvents {
  "submission:verdict": { submissionId: string; status: SubmissionStatus; verdict?: SubmissionVerdict[] };
  "contest:standing_update": { contestId: string; standings: ContestStanding[] };
  "contest:join": { contestId: string };
  "contest:leave": { contestId: string };
}

// Supported languages for code execution
export const SUPPORTED_LANGUAGES = [
  { id: "cpp", name: "C++", judge0Id: 54 },
  { id: "c", name: "C", judge0Id: 50 },
  { id: "java", name: "Java", judge0Id: 62 },
  { id: "python", name: "Python 3", judge0Id: 71 },
  { id: "javascript", name: "JavaScript (Node.js)", judge0Id: 63 },
  { id: "typescript", name: "TypeScript", judge0Id: 74 },
  { id: "go", name: "Go", judge0Id: 60 },
  { id: "rust", name: "Rust", judge0Id: 73 },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["id"];

// Points per difficulty
export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  [Difficulty.EASY]: 10,
  [Difficulty.MEDIUM]: 25,
  [Difficulty.HARD]: 50,
};
