import "dotenv/config";
import {
  AttendanceStatus,
  ContestStatus,
  ContestType,
  Difficulty,
  ExamType,
  HackathonStatus,
  PrismaClient,
  Role,
  SkillLevel,
} from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type CreatedUser = Awaited<ReturnType<typeof createUser>>;

async function resetDatabase() {
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.sectionLeaderboard.deleteMany();
  await prisma.hackathonRegistration.deleteMany();
  await prisma.hackathonTeam.deleteMany();
  await prisma.hackathon.deleteMany();
  await prisma.competitionRegistration.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.leaderboard.deleteMany();
  await prisma.contestStanding.deleteMany();
  await prisma.contestRegistration.deleteMany();
  await prisma.contestProblem.deleteMany();
  await prisma.contest.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.assignmentSubmission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.attendanceSession.deleteMany();
  await prisma.teacherSubjectAssignment.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.project.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.section.deleteMany();
  await prisma.department.deleteMany();
}

async function createUser(input: {
  name: string;
  email: string;
  role: Role;
  handle: string;
  githubUsername?: string;
  studentProfile?: {
    githubUsername?: string;
    leetcodeUsername?: string;
    codechefUsername?: string;
    codeforcesUsername?: string;
    leetcodeSolved?: number;
    leetcodeEasy?: number;
    leetcodeMedium?: number;
    leetcodeHard?: number;
    githubContributions?: number;
    codechefRating?: number;
    codeforcesRating?: number;
    cgpa?: number;
    bio?: string;
    skills?: Array<{ name: string; category: string; level: SkillLevel }>;
    projects?: Array<{
      title: string;
      description: string;
      techStack: string[];
      githubUrl?: string;
      liveUrl?: string;
      featured?: boolean;
    }>;
    achievements?: Array<{
      title: string;
      description?: string;
      date: Date;
      category: string;
    }>;
    activityHeatmap?: Record<string, number>;
  };
}) {
  return prisma.user.create({
    data: {
      supabaseId: `seed-${input.handle}`,
      email: input.email,
      name: input.name,
      role: input.role,
      isVerified: true,
      githubUsername: input.githubUsername,
      profile: {
        create: {
          handle: input.handle,
          skills: [],
          isPublic: input.role === Role.STUDENT,
        },
      },
      ...(input.role === Role.STUDENT
        ? {
            leaderboard: { create: {} },
            studentProfile: {
              create: {
                githubUsername: input.studentProfile?.githubUsername ?? null,
                leetcodeUsername: input.studentProfile?.leetcodeUsername ?? null,
                codechefUsername: input.studentProfile?.codechefUsername ?? null,
                codeforcesUsername: input.studentProfile?.codeforcesUsername ?? null,
                leetcodeSolved: input.studentProfile?.leetcodeSolved ?? 0,
                leetcodeEasy: input.studentProfile?.leetcodeEasy ?? 0,
                leetcodeMedium: input.studentProfile?.leetcodeMedium ?? 0,
                leetcodeHard: input.studentProfile?.leetcodeHard ?? 0,
                githubContributions: input.studentProfile?.githubContributions ?? 0,
                codechefRating: input.studentProfile?.codechefRating ?? null,
                codeforcesRating: input.studentProfile?.codeforcesRating ?? null,
                cgpa: input.studentProfile?.cgpa ?? null,
                bio: input.studentProfile?.bio ?? null,
                activityHeatmap: input.studentProfile?.activityHeatmap ?? {},
                skills: {
                  create: input.studentProfile?.skills ?? [],
                },
                projects: {
                  create: input.studentProfile?.projects ?? [],
                },
                achievements: {
                  create: input.studentProfile?.achievements ?? [],
                },
              },
            },
          }
        : {}),
    },
    include: {
      profile: true,
      studentProfile: true,
      leaderboard: true,
    },
  });
}

async function main() {
  console.log("Seeding RankRoom academic platform data...");
  await resetDatabase();

  const superAdmin = await createUser({
    name: "Platform Super Admin",
    email: "superadmin@rankroom.dev",
    role: Role.SUPER_ADMIN,
    handle: "platform-super-admin",
  });

  const admin = await createUser({
    name: "Institution Admin",
    email: "admin@rankroom.dev",
    role: Role.ADMIN,
    handle: "institution-admin",
  });

  const departmentHead = await createUser({
    name: "Dr. Meera Sharma",
    email: "meera.sharma@rankroom.dev",
    role: Role.DEPARTMENT_HEAD,
    handle: "meera-sharma",
  });

  const classCoordinator = await createUser({
    name: "Prof. Arjun Rao",
    email: "arjun.rao@rankroom.dev",
    role: Role.CLASS_COORDINATOR,
    handle: "arjun-rao",
  });

  const teacherOne = await createUser({
    name: "Prof. Kavya Nair",
    email: "kavya.nair@rankroom.dev",
    role: Role.TEACHER,
    handle: "kavya-nair",
  });

  const teacherTwo = await createUser({
    name: "Prof. Rohan Das",
    email: "rohan.das@rankroom.dev",
    role: Role.TEACHER,
    handle: "rohan-das",
  });

  const studentOne = await createUser({
    name: "Aarav Patel",
    email: "aarav.patel@rankroom.dev",
    role: Role.STUDENT,
    handle: "aarav-patel",
    githubUsername: "aaravpatel-dev",
    studentProfile: {
      githubUsername: "aaravpatel-dev",
      leetcodeUsername: "aarav_leetcodes",
      codechefUsername: "aaravchef",
      codeforcesUsername: "aarav_cf",
      leetcodeSolved: 342,
      leetcodeEasy: 152,
      leetcodeMedium: 154,
      leetcodeHard: 36,
      githubContributions: 418,
      codechefRating: 1720,
      codeforcesRating: 1490,
      cgpa: 8.7,
      bio: "Frontend-focused builder who enjoys contests and hackathons.",
      skills: [
        { name: "React", category: "Frontend", level: SkillLevel.ADVANCED },
        { name: "TypeScript", category: "Frontend", level: SkillLevel.ADVANCED },
        { name: "Node.js", category: "Backend", level: SkillLevel.INTERMEDIATE },
      ],
      projects: [
        {
          title: "RankRoom Mentor Portal",
          description: "A mentoring dashboard with analytics and event tracking.",
          techStack: ["Next.js", "TypeScript", "Tailwind"],
          githubUrl: "https://github.com/example/rankroom-mentor",
          featured: true,
        },
      ],
      achievements: [
        {
          title: "Department Hackathon Winner",
          description: "Won the 2025 internal innovation sprint.",
          date: new Date("2025-09-14T00:00:00.000Z"),
          category: "Hackathon",
        },
      ],
      activityHeatmap: {
        "2026-01-15": 3,
        "2026-02-02": 6,
        "2026-02-16": 2,
        "2026-03-01": 5,
      },
    },
  });

  const studentTwo = await createUser({
    name: "Diya Menon",
    email: "diya.menon@rankroom.dev",
    role: Role.STUDENT,
    handle: "diya-menon",
    githubUsername: "diyamenon-code",
    studentProfile: {
      githubUsername: "diyamenon-code",
      leetcodeUsername: "diya_daily",
      leetcodeSolved: 221,
      leetcodeEasy: 101,
      leetcodeMedium: 96,
      leetcodeHard: 24,
      githubContributions: 265,
      cgpa: 9.1,
      bio: "Enjoys UI systems, accessibility, and campus design competitions.",
      skills: [
        { name: "Figma", category: "Design", level: SkillLevel.ADVANCED },
        { name: "React", category: "Frontend", level: SkillLevel.INTERMEDIATE },
      ],
      projects: [
        {
          title: "Campus Club Hub",
          description: "A student club discovery and event management portal.",
          techStack: ["Next.js", "Prisma", "Supabase"],
          githubUrl: "https://github.com/example/campus-club-hub",
          liveUrl: "https://campus-club-hub.example.com",
        },
      ],
      achievements: [
        {
          title: "UI Design Challenge Finalist",
          date: new Date("2025-11-08T00:00:00.000Z"),
          category: "Competition",
        },
      ],
      activityHeatmap: {
        "2026-01-05": 1,
        "2026-02-21": 4,
        "2026-03-12": 7,
      },
    },
  });

  const studentThree = await createUser({
    name: "Vihaan Gupta",
    email: "vihaan.gupta@rankroom.dev",
    role: Role.STUDENT,
    handle: "vihaan-gupta",
    githubUsername: "vihaangupta",
    studentProfile: {
      githubUsername: "vihaangupta",
      codeforcesUsername: "vihaan_cf",
      githubContributions: 144,
      codeforcesRating: 1360,
      cgpa: 7.9,
      bio: "Backend learner working on problem solving consistency.",
      skills: [
        { name: "Java", category: "Backend", level: SkillLevel.INTERMEDIATE },
        { name: "SQL", category: "Database", level: SkillLevel.INTERMEDIATE },
      ],
      projects: [
        {
          title: "Attendance API",
          description: "REST API for attendance and report exports.",
          techStack: ["Express", "Prisma", "PostgreSQL"],
        },
      ],
      activityHeatmap: {
        "2026-02-08": 2,
        "2026-02-19": 1,
        "2026-03-14": 3,
      },
    },
  });

  const engineering = await prisma.department.create({
    data: {
      name: "Engineering",
      code: "ENG",
      description: "Core engineering programs and coding cohorts.",
      headId: departmentHead.id,
    },
  });

  const sectionE2 = await prisma.section.create({
    data: {
      name: "Section E2",
      code: "E2",
      departmentId: engineering.id,
      coordinatorId: classCoordinator.id,
      semester: 4,
      academicYear: "2025-26",
      legacyYear: 2025,
      legacyTeacherId: teacherOne.id,
    },
  });

  const sectionE3 = await prisma.section.create({
    data: {
      name: "Section E3",
      code: "E3",
      departmentId: engineering.id,
      semester: 4,
      academicYear: "2025-26",
      legacyYear: 2025,
      legacyTeacherId: teacherTwo.id,
    },
  });

  const webTech = await prisma.subject.create({
    data: {
      name: "Web Technologies",
      code: "WT401",
      sectionId: sectionE2.id,
      departmentId: engineering.id,
      teacherId: teacherOne.id,
    },
  });

  const dataStructures = await prisma.subject.create({
    data: {
      name: "Data Structures",
      code: "DS402",
      sectionId: sectionE2.id,
      departmentId: engineering.id,
      teacherId: teacherTwo.id,
    },
  });

  const systemsDesign = await prisma.subject.create({
    data: {
      name: "Systems Design",
      code: "SD403",
      sectionId: sectionE3.id,
      departmentId: engineering.id,
      teacherId: teacherTwo.id,
    },
  });

  await prisma.teacherSubjectAssignment.createMany({
    data: [
      { teacherId: teacherOne.id, subjectId: webTech.id, sectionId: sectionE2.id },
      { teacherId: teacherTwo.id, subjectId: dataStructures.id, sectionId: sectionE2.id },
      { teacherId: classCoordinator.id, subjectId: webTech.id, sectionId: sectionE2.id },
      { teacherId: teacherTwo.id, subjectId: systemsDesign.id, sectionId: sectionE3.id },
    ],
    skipDuplicates: true,
  });

  await prisma.enrollment.createMany({
    data: [
      { studentId: studentOne.id, sectionId: sectionE2.id },
      { studentId: studentTwo.id, sectionId: sectionE2.id },
      { studentId: studentThree.id, sectionId: sectionE2.id },
    ],
    skipDuplicates: true,
  });

  const attendanceSession = await prisma.attendanceSession.create({
    data: {
      sectionId: sectionE2.id,
      subjectId: webTech.id,
      takenById: teacherOne.id,
      date: new Date("2026-03-20T00:00:00.000Z"),
      topic: "React state management and server rendering",
    },
  });

  await prisma.attendanceRecord.createMany({
    data: [
      { attendanceSessionId: attendanceSession.id, studentId: studentOne.id, status: AttendanceStatus.PRESENT },
      { attendanceSessionId: attendanceSession.id, studentId: studentTwo.id, status: AttendanceStatus.LATE },
      { attendanceSessionId: attendanceSession.id, studentId: studentThree.id, status: AttendanceStatus.ABSENT },
    ],
  });

  await prisma.grade.createMany({
    data: [
      {
        studentId: studentOne.id,
        subjectId: webTech.id,
        teacherId: teacherOne.id,
        examType: ExamType.MID,
        marks: 86,
        maxMarks: 100,
        semester: 4,
      },
      {
        studentId: studentTwo.id,
        subjectId: webTech.id,
        teacherId: teacherOne.id,
        examType: ExamType.MID,
        marks: 92,
        maxMarks: 100,
        semester: 4,
      },
      {
        studentId: studentThree.id,
        subjectId: webTech.id,
        teacherId: teacherOne.id,
        examType: ExamType.MID,
        marks: 74,
        maxMarks: 100,
        semester: 4,
      },
    ],
  });

  const assignment = await prisma.assignment.create({
    data: {
      title: "Build a realtime notification center",
      description: "Create a role-aware notification center using websockets and optimistic UI.",
      subjectId: webTech.id,
      teacherId: teacherOne.id,
      dueDate: new Date("2026-04-10T18:00:00.000Z"),
      maxScore: 100,
    },
  });

  await prisma.assignmentSubmission.createMany({
    data: [
      {
        assignmentId: assignment.id,
        studentId: studentOne.id,
        submittedAt: new Date("2026-03-22T10:00:00.000Z"),
        fileUrl: "https://storage.example.com/submissions/assignment-1-aarav.zip",
        score: 94,
        feedback: "Strong implementation and clean UI.",
        status: "GRADED",
      },
      {
        assignmentId: assignment.id,
        studentId: studentTwo.id,
        submittedAt: new Date("2026-03-23T14:30:00.000Z"),
        fileUrl: "https://storage.example.com/submissions/assignment-1-diya.zip",
        score: 88,
        feedback: "Great design polish, minor API error handling gaps.",
        status: "GRADED",
      },
      {
        assignmentId: assignment.id,
        studentId: studentThree.id,
        submittedAt: new Date("2026-03-24T16:00:00.000Z"),
        fileUrl: "https://storage.example.com/submissions/assignment-1-vihaan.zip",
        status: "SUBMITTED",
      },
    ],
  });

  const problemOne = await prisma.problem.create({
    data: {
      title: "Two Sum Stream",
      slug: "two-sum-stream",
      description: "Design a data structure that answers two-sum queries over a stream.",
      difficulty: Difficulty.EASY,
      tags: ["array", "hashmap"],
      createdById: teacherOne.id,
      isPublished: true,
      points: 50,
    },
  });

  const problemTwo = await prisma.problem.create({
    data: {
      title: "Section Leaderboard Rank Delta",
      slug: "section-leaderboard-rank-delta",
      description: "Track rank movement over recompute cycles.",
      difficulty: Difficulty.MEDIUM,
      tags: ["sorting", "data-structures"],
      createdById: teacherTwo.id,
      isPublished: true,
      points: 100,
    },
  });

  await prisma.testCase.createMany({
    data: [
      {
        problemId: problemOne.id,
        input: "4\n1 3 5 7\n8",
        expectedOutput: "YES",
        isSample: true,
      },
      {
        problemId: problemOne.id,
        input: "5\n2 4 6 8 10\n7",
        expectedOutput: "NO",
        isHidden: true,
      },
      {
        problemId: problemTwo.id,
        input: "3\n90 88 82",
        expectedOutput: "1 2 3",
        isSample: true,
      },
      {
        problemId: problemTwo.id,
        input: "4\n70 95 95 50",
        expectedOutput: "3 1 2 4",
        isHidden: true,
      },
    ],
  });

  await prisma.submission.createMany({
    data: [
      {
        userId: studentOne.id,
        problemId: problemOne.id,
        code: "print('accepted')",
        language: "python",
        status: "ACCEPTED",
      },
      {
        userId: studentOne.id,
        problemId: problemTwo.id,
        code: "print('accepted')",
        language: "python",
        status: "ACCEPTED",
      },
      {
        userId: studentTwo.id,
        problemId: problemOne.id,
        code: "print('accepted')",
        language: "python",
        status: "ACCEPTED",
      },
      {
        userId: studentThree.id,
        problemId: problemOne.id,
        code: "print('wa')",
        language: "python",
        status: "WRONG_ANSWER",
      },
    ],
  });

  const contest = await prisma.contest.create({
    data: {
      title: "Section E2 Weekly Contest",
      description: "Internal coding contest for Section E2.",
      startTime: new Date("2026-04-03T10:00:00.000Z"),
      endTime: new Date("2026-04-03T12:00:00.000Z"),
      type: ContestType.INSTITUTIONAL,
      status: ContestStatus.UPCOMING,
      sectionId: sectionE2.id,
      createdById: teacherOne.id,
      rules: "No plagiarism. Standard ACM scoring.",
      problems: {
        create: [
          { problemId: problemOne.id, order: 1, points: 100 },
          { problemId: problemTwo.id, order: 2, points: 150 },
        ],
      },
    },
  });

  await prisma.contestRegistration.createMany({
    data: [
      { contestId: contest.id, userId: studentOne.id },
      { contestId: contest.id, userId: studentTwo.id },
      { contestId: contest.id, userId: studentThree.id },
    ],
  });

  await prisma.contestStanding.createMany({
    data: [
      { contestId: contest.id, userId: studentOne.id, totalScore: 250, solvedCount: 2, rank: 1 },
      { contestId: contest.id, userId: studentTwo.id, totalScore: 100, solvedCount: 1, rank: 2 },
      { contestId: contest.id, userId: studentThree.id, totalScore: 0, solvedCount: 0, rank: 3 },
    ],
  });

  const hackathon = await prisma.hackathon.create({
    data: {
      title: "RankRoom Build Sprint",
      description: "Build a section analytics or student profile experience in 24 hours.",
      departmentId: engineering.id,
      createdById: departmentHead.id,
      minSkills: ["React", "TypeScript"],
      minProjects: 1,
      minLeetcode: 100,
      minCgpa: 7.5,
      startDate: new Date("2026-04-20T09:00:00.000Z"),
      endDate: new Date("2026-04-21T18:00:00.000Z"),
      registrationDeadline: new Date("2026-04-15T23:59:59.000Z"),
      maxTeamSize: 4,
      minTeamSize: 1,
      prizeDetails: "Winning team receives internship interviews and swag.",
      status: HackathonStatus.REGISTRATION_OPEN,
    },
  });

  const hackathonTeam = await prisma.hackathonTeam.create({
    data: {
      name: "Realtime Rebels",
      teamCode: "REBELS",
      hackathonId: hackathon.id,
      leaderId: studentOne.id,
    },
  });

  await prisma.hackathonRegistration.createMany({
    data: [
      {
        hackathonId: hackathon.id,
        studentId: studentOne.id,
        teamId: hackathonTeam.id,
        isEligible: true,
        eligibilityNote: "Eligible to register",
      },
      {
        hackathonId: hackathon.id,
        studentId: studentTwo.id,
        teamId: hackathonTeam.id,
        isEligible: true,
        eligibilityNote: "Eligible to register",
      },
      {
        hackathonId: hackathon.id,
        studentId: studentThree.id,
        isEligible: false,
        eligibilityNote: "Requires 100+ LeetCode solved",
      },
    ],
  });

  await prisma.leaderboard.updateMany({
    where: { userId: studentOne.id },
    data: {
      totalPoints: 150,
      problemsSolved: 2,
      easySolved: 1,
      mediumSolved: 1,
      rank: 1,
    },
  });

  await prisma.leaderboard.updateMany({
    where: { userId: studentTwo.id },
    data: {
      totalPoints: 50,
      problemsSolved: 1,
      easySolved: 1,
      rank: 2,
    },
  });

  await prisma.sectionLeaderboard.createMany({
    data: [
      {
        sectionId: sectionE2.id,
        studentId: studentOne.id,
        cgpaScore: 21.75,
        codingScore: 18,
        assignmentScore: 18.8,
        hackathonScore: 5,
        profileScore: 8,
        externalScore: 11.5,
        totalScore: 83.05,
        rank: 1,
      },
      {
        sectionId: sectionE2.id,
        studentId: studentTwo.id,
        cgpaScore: 22.75,
        codingScore: 10,
        assignmentScore: 17.6,
        hackathonScore: 5,
        profileScore: 7,
        externalScore: 8.5,
        totalScore: 70.85,
        rank: 2,
      },
      {
        sectionId: sectionE2.id,
        studentId: studentThree.id,
        cgpaScore: 19.75,
        codingScore: 3,
        assignmentScore: 8,
        hackathonScore: 0,
        profileScore: 4,
        externalScore: 4,
        totalScore: 38.75,
        rank: 3,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: studentOne.id,
        type: "ASSIGNMENT_POSTED",
        title: "New Assignment",
        message: `A new assignment "${assignment.title}" is now available.`,
        link: `/assignments/${assignment.id}`,
        entityId: assignment.id,
        entityType: "ASSIGNMENT",
        targetSectionId: sectionE2.id,
        targetDepartmentId: engineering.id,
      },
      {
        userId: studentTwo.id,
        type: "HACKATHON_CREATED",
        title: "New Hackathon",
        message: `${hackathon.title} is open for registration.`,
        link: `/hackathons/${hackathon.id}`,
        entityId: hackathon.id,
        entityType: "HACKATHON",
        targetDepartmentId: engineering.id,
      },
      {
        userId: classCoordinator.id,
        type: "ATTENDANCE_LOW",
        title: "Low attendance in Web Technologies",
        message: `${studentThree.name} is below 75% attendance.`,
        link: `/attendance/reports?sectionId=${sectionE2.id}`,
        entityId: webTech.id,
        entityType: "ATTENDANCE",
        targetSectionId: sectionE2.id,
        targetDepartmentId: engineering.id,
      },
    ],
  });

  console.log("Seed complete.");
  console.table([
    { role: superAdmin.role, email: superAdmin.email },
    { role: admin.role, email: admin.email },
    { role: departmentHead.role, email: departmentHead.email },
    { role: classCoordinator.role, email: classCoordinator.email },
    { role: teacherOne.role, email: teacherOne.email },
    { role: teacherTwo.role, email: teacherTwo.email },
    { role: studentOne.role, email: studentOne.email },
    { role: studentTwo.role, email: studentTwo.email },
    { role: studentThree.role, email: studentThree.email },
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
