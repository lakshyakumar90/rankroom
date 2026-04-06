import { prisma } from "@repo/database";

export interface EligibilityCriteria {
  minProblemsSolved?: number;
  minContestsParticipated?: number;
  minAttendancePercent?: number;
  minXP?: number;
  minLeetcode?: number;
  minCgpa?: number;
  allowedDepartments?: string[];
  allowedClasses?: string[];
  allowedYears?: number[];
  minTeamSize?: number;
  maxTeamSize?: number;
}

export interface EligibilityCheckDetail {
  required: number | string | string[] | number[];
  actual: number | string | string[] | number[] | null;
  passed: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  passed: string[];
  failed: string[];
  details: Record<string, EligibilityCheckDetail>;
}

/**
 * Evaluate a student's eligibility against a set of criteria.
 * Returns a detailed breakdown of which criteria passed/failed.
 */
export async function checkEligibility(
  studentId: string,
  criteria: EligibilityCriteria
): Promise<EligibilityResult> {
  const [leaderboard, studentProfile, enrollments, contestCount, attendanceData] =
    await Promise.all([
      prisma.leaderboard.findUnique({ where: { userId: studentId } }),
      prisma.studentProfile.findUnique({ where: { userId: studentId } }),
      prisma.enrollment.findMany({
        where: { studentId },
        include: { section: { include: { department: true } } },
      }),
      prisma.contestRegistration.count({ where: { userId: studentId } }),
      getOverallAttendancePercent(studentId),
    ]);

  const details: Record<string, EligibilityCheckDetail> = {};

  if (criteria.minProblemsSolved !== undefined) {
    const actual = leaderboard?.problemsSolved ?? 0;
    details.minProblemsSolved = {
      required: criteria.minProblemsSolved,
      actual,
      passed: actual >= criteria.minProblemsSolved,
    };
  }

  if (criteria.minContestsParticipated !== undefined) {
    details.minContestsParticipated = {
      required: criteria.minContestsParticipated,
      actual: contestCount,
      passed: contestCount >= criteria.minContestsParticipated,
    };
  }

  if (criteria.minAttendancePercent !== undefined) {
    details.minAttendancePercent = {
      required: criteria.minAttendancePercent,
      actual: attendanceData,
      passed: attendanceData !== null && attendanceData >= criteria.minAttendancePercent,
    };
  }

  if (criteria.minXP !== undefined) {
    const actual = leaderboard?.totalPoints ?? 0;
    details.minXP = {
      required: criteria.minXP,
      actual,
      passed: actual >= criteria.minXP,
    };
  }

  if (criteria.minLeetcode !== undefined) {
    const actual = studentProfile?.leetcodeSolved ?? 0;
    details.minLeetcode = {
      required: criteria.minLeetcode,
      actual,
      passed: actual >= criteria.minLeetcode,
    };
  }

  if (criteria.minCgpa !== undefined) {
    const actual = studentProfile?.cgpa ?? null;
    details.minCgpa = {
      required: criteria.minCgpa,
      actual,
      passed: actual !== null && actual >= criteria.minCgpa,
    };
  }

  if (criteria.allowedDepartments && criteria.allowedDepartments.length > 0) {
    const studentDeptCodes = enrollments.map((e) => e.section.department.code);
    const allowed = criteria.allowedDepartments;
    const passed = studentDeptCodes.some((code) => allowed.includes(code));
    details.allowedDepartments = {
      required: allowed,
      actual: studentDeptCodes,
      passed,
    };
  }

  if (criteria.allowedYears && criteria.allowedYears.length > 0) {
    const studentYears = enrollments
      .map((e) => e.section.legacyYear)
      .filter((y): y is number => y !== null);
    const passed = studentYears.some((y) => criteria.allowedYears!.includes(y));
    details.allowedYears = {
      required: criteria.allowedYears,
      actual: studentYears,
      passed,
    };
  }

  const passed = Object.entries(details)
    .filter(([, v]) => v.passed)
    .map(([k]) => k);

  const failed = Object.entries(details)
    .filter(([, v]) => !v.passed)
    .map(([k]) => k);

  return {
    eligible: failed.length === 0,
    passed,
    failed,
    details,
  };
}

/**
 * Compute the overall attendance percentage for a student across all subjects.
 * Returns a number 0-100, or null if no attendance data exists.
 */
export async function getOverallAttendancePercent(
  studentId: string
): Promise<number | null> {
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId },
    select: { status: true },
  });

  if (records.length === 0) return null;

  const present = records.filter((r) => r.status !== "ABSENT").length;
  return Math.round((present / records.length) * 100);
}

/**
 * Compute attendance percentage for a student in a specific subject.
 */
export async function getSubjectAttendancePercent(
  studentId: string,
  subjectId: string
): Promise<number | null> {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      attendanceSession: { subjectId },
    },
    select: { status: true },
  });

  if (records.length === 0) return null;

  const present = records.filter((r) => r.status !== "ABSENT").length;
  return Math.round((present / records.length) * 100);
}
