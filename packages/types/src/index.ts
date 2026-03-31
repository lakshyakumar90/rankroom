import type { SubmissionResult } from "./submission.types";

export * from "./submission.types";

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  DEPARTMENT_HEAD = "DEPARTMENT_HEAD",
  CLASS_COORDINATOR = "CLASS_COORDINATOR",
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

export enum SkillLevel {
  BEGINNER = "BEGINNER",
  INTERMEDIATE = "INTERMEDIATE",
  ADVANCED = "ADVANCED",
  EXPERT = "EXPERT",
}

export enum HackathonStatus {
  DRAFT = "DRAFT",
  UPCOMING = "UPCOMING",
  REGISTRATION_OPEN = "REGISTRATION_OPEN",
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum CompetitionType {
  CODING = "CODING",
  DESIGN = "DESIGN",
  PRESENTATION = "PRESENTATION",
  QUIZ = "QUIZ",
  OTHER = "OTHER",
}

export enum NotificationType {
  ASSIGNMENT_POSTED = "ASSIGNMENT_POSTED",
  ASSIGNMENT_GRADED = "ASSIGNMENT_GRADED",
  GRADE_PUBLISHED = "GRADE_PUBLISHED",
  CONTEST_CREATED = "CONTEST_CREATED",
  CONTEST_STARTING = "CONTEST_STARTING",
  CONTEST_STARTING_SOON = "CONTEST_STARTING_SOON",
  CONTEST_ENDED = "CONTEST_ENDED",
  HACKATHON_CREATED = "HACKATHON_CREATED",
  HACKATHON_REGISTRATION_OPEN = "HACKATHON_REGISTRATION_OPEN",
  HACKATHON_DEADLINE_APPROACHING = "HACKATHON_DEADLINE_APPROACHING",
  COMPETITION_CREATED = "COMPETITION_CREATED",
  SUBMISSION_JUDGED = "SUBMISSION_JUDGED",
  SUBMISSION_ACCEPTED = "SUBMISSION_ACCEPTED",
  ENROLLMENT_ADDED = "ENROLLMENT_ADDED",
  LEADERBOARD_UPDATED = "LEADERBOARD_UPDATED",
  ATTENDANCE_LOW = "ATTENDANCE_LOW",
  ANNOUNCEMENT = "ANNOUNCEMENT",
  GENERAL = "GENERAL",
}

export type PermissionKey =
  | "users:create"
  | "users:delete"
  | "users:read:any"
  | "users:read:section"
  | "departments:create"
  | "departments:update"
  | "departments:delete"
  | "sections:create"
  | "sections:update"
  | "sections:delete"
  | "attendance:create"
  | "attendance:update"
  | "attendance:read:any"
  | "attendance:read:section"
  | "attendance:read:own"
  | "grades:create"
  | "grades:update"
  | "grades:read:any"
  | "grades:read:section"
  | "grades:read:own"
  | "assignments:create"
  | "assignments:delete"
  | "assignments:grade"
  | "assignments:submit"
  | "contests:create"
  | "contests:delete"
  | "contests:participate"
  | "hackathons:create"
  | "hackathons:update"
  | "hackathons:delete"
  | "hackathons:register"
  | "problems:create"
  | "problems:delete"
  | "profile:update:own"
  | "profile:view:public"
  | "profile:view:private"
  | "leaderboard:view"
  | "analytics:platform"
  | "analytics:department"
  | "analytics:section"
  | "analytics:own"
  | "notifications:send:platform"
  | "notifications:send:department"
  | "notifications:send:section";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: Pagination;
  unreadCount?: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface AuthAssignmentScope {
  teacherId: string;
  subjectId: string;
  sectionId: string;
}

export interface AuthScope {
  departmentIds: string[];
  sectionIds: string[];
  teachingAssignments: AuthAssignmentScope[];
  primaryDepartmentId?: string | null;
  primarySectionId?: string | null;
}

export interface JWTPayload {
  id: string;
  supabaseId: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string | null;
  githubUsername?: string | null;
  scope: AuthScope;
}

export interface UserPublic {
  id: string;
  email?: string;
  name: string;
  role: Role;
  avatar?: string | null;
  githubUsername?: string | null;
  createdAt: string;
}

export interface ProfilePublic {
  userId: string;
  handle?: string | null;
  bio?: string | null;
  skills: string[];
  socialLinks?: Record<string, string> | null;
  college?: string | null;
  batch?: string | null;
  department?: string | null;
  isPublic: boolean;
  totalPoints: number;
  rank?: number | null;
  streak: number;
}

export interface StudentProfile {
  id: string;
  userId: string;
  leetcodeUsername?: string | null;
  githubUsername?: string | null;
  codechefUsername?: string | null;
  codeforcesUsername?: string | null;
  hackerrankUsername?: string | null;
  leetcodeSolved: number;
  leetcodeEasy: number;
  leetcodeMedium: number;
  leetcodeHard: number;
  leetcodeAcceptanceRate?: number | null;
  githubContributions: number;
  githubTopLanguages?: Array<{ language: string; count: number }>;
  codechefRating?: number | null;
  codechefMaxRating?: number | null;
  codechefStars?: number | null;
  codeforcesRating?: number | null;
  codeforcesMaxRating?: number | null;
  codeforcesRank?: string | null;
  cgpa?: number | null;
  activityHeatmap: Record<string, number>;
  lastSyncedAt?: string | null;
  bio?: string | null;
  resumeUrl?: string | null;
  resumeFilename?: string | null;
  isPublic: boolean;
  skills: Skill[];
  projects: Project[];
  achievements: Achievement[];
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: SkillLevel;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  githubUrl?: string | null;
  liveUrl?: string | null;
  imageUrl?: string | null;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  category: string;
  certificateUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  headId?: string | null;
  head?: UserPublic | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Section {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  department?: Department;
  coordinatorId?: string | null;
  coordinator?: UserPublic | null;
  semester: number;
  academicYear: string;
  createdAt: string;
  updatedAt: string;
}

export type Batch = Section;

export interface Subject {
  id: string;
  name: string;
  code: string;
  sectionId: string;
  departmentId: string;
  teacherId?: string | null;
}

export interface TeacherSubjectAssignment {
  id: string;
  teacherId: string;
  teacher?: UserPublic;
  subjectId: string;
  subject?: Subject;
  sectionId: string;
  section?: Section;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  attendanceSessionId: string;
  studentId: string;
  student?: UserPublic;
  status: AttendanceStatus;
}

export interface AttendanceSession {
  id: string;
  sectionId: string;
  section?: Section;
  subjectId: string;
  subject?: Subject;
  takenById: string;
  takenBy?: UserPublic;
  date: string;
  topic?: string | null;
  records: AttendanceRecord[];
  createdAt: string;
}

export type Attendance = AttendanceSession;

export interface AttendanceSummaryRow {
  studentId: string;
  studentName: string;
  rollNumber?: string | null;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
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
  audience?: Array<{ studentId: string }>;
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

export interface SubmissionVerdict {
  testCaseIndex: number;
  status: string;
  stdout?: string;
  stderr?: string;
  runtime?: number;
  memory?: number;
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

export interface Contest {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  type: ContestType;
  status: ContestStatus;
  createdById: string;
  sectionId?: string | null;
  audience?: Array<{ studentId: string }>;
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

export interface HackathonEligibility {
  isEligible: boolean;
  reason: string;
  missingSkills?: string[];
  currentProjects?: number;
  currentLeetcode?: number;
  currentCgpa?: number | null;
}

export interface HackathonTeamMember {
  id: string;
  studentId: string;
  student?: UserPublic;
  isEligible: boolean;
  eligibilityNote?: string | null;
}

export interface HackathonTeam {
  id: string;
  name: string;
  teamCode: string;
  hackathonId: string;
  leaderId: string;
  leader?: UserPublic;
  members: HackathonTeamMember[];
  submissionUrl?: string | null;
  rank?: number | null;
  createdAt: string;
}

export interface HackathonRegistration {
  id: string;
  hackathonId: string;
  studentId: string;
  student?: UserPublic;
  teamId?: string | null;
  team?: HackathonTeam | null;
  isEligible: boolean;
  eligibilityNote?: string | null;
  registeredAt: string;
}

export interface Hackathon {
  id: string;
  title: string;
  description: string;
  departmentId?: string | null;
  department?: Department | null;
  createdById: string;
  createdBy?: UserPublic;
  minSkills: string[];
  minProjects: number;
  minLeetcode: number;
  minCgpa?: number | null;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  maxTeamSize: number;
  minTeamSize: number;
  prizeDetails?: string | null;
  status: HackathonStatus;
  createdAt: string;
  updatedAt: string;
  teams?: HackathonTeam[];
  registrations?: HackathonRegistration[];
  audience?: Array<{ studentId: string }>;
  eligibility?: HackathonEligibility;
}

export interface CompetitionRegistration {
  id: string;
  competitionId: string;
  studentId: string;
  isEligible: boolean;
  registeredAt: string;
}

export interface Competition {
  id: string;
  title: string;
  description: string;
  departmentId?: string | null;
  sectionId?: string | null;
  createdById: string;
  type: CompetitionType;
  minSkills: string[];
  minProjects: number;
  startDate: string;
  endDate: string;
  status: HackathonStatus;
  createdAt: string;
}

export type LeaderboardFilter = "overall" | "coding" | "academic" | "profile" | "external";

export interface SectionLeaderboardEntry {
  id: string;
  sectionId: string;
  studentId: string;
  student: UserPublic & {
    studentProfile?: Pick<
      StudentProfile,
      "leetcodeSolved" | "githubContributions" | "cgpa" | "skills" | "projects" | "achievements"
    > | null;
  };
  cgpaScore: number;
  codingScore: number;
  assignmentScore: number;
  hackathonScore: number;
  profileScore: number;
  externalScore: number;
  totalScore: number;
  rank?: number | null;
  previousRank?: number | null;
  problemsSolved?: number;
  contestWins?: number;
  lastComputedAt: string;
  updatedAt: string;
}

export interface SectionLeaderboardResponse {
  section: Section;
  filter: LeaderboardFilter;
  items: SectionLeaderboardEntry[];
  lastUpdatedAt?: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  targetRole?: Role | null;
  targetSectionId?: string | null;
  targetDepartmentId?: string | null;
  createdAt: string;
}

export interface NotificationSendRequest {
  type: NotificationType;
  title: string;
  message: string;
  targetSectionId?: string;
  targetDepartmentId?: string;
  targetRole?: Role;
  entityId?: string;
  entityType?: string;
  link?: string;
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

export interface SocketEvents {
  "notification:new": Notification;
  "leaderboard:updated": { sectionId: string; updatedAt: string };
  "submission:result": SubmissionResult;
  "contest:standing_update": { contestId: string; standings: ContestStanding[] };
  "contest:join": { contestId: string };
  "contest:leave": { contestId: string };
  "user:join": { userId: string };
  "section:join": { sectionId: string };
  "department:join": { departmentId: string };
}

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

export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  [Difficulty.EASY]: 10,
  [Difficulty.MEDIUM]: 25,
  [Difficulty.HARD]: 50,
};
