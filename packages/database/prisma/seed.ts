import "dotenv/config";
import { PrismaClient, Role, Difficulty } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up existing data
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
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
  await prisma.attendance.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.department.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  // Create Admin
  const admin = await prisma.user.create({
    data: {
      supabaseId: "seed-admin-001",
      email: "admin@rankroom.dev",
      name: "Admin User",
      role: Role.ADMIN,
      isVerified: true,
      profile: {
        create: {
          bio: "Platform administrator",
          skills: ["Administration", "Management"],
        },
      },
    },
  });

  // Create Department
  const dept = await prisma.department.create({
    data: {
      name: "Computer Science & Engineering",
      code: "CSE",
      headId: admin.id,
    },
  });

  // Create Teachers
  const teacher1 = await prisma.user.create({
    data: {
      supabaseId: "seed-teacher-001",
      email: "teacher1@rankroom.dev",
      name: "Dr. Alice Smith",
      role: Role.TEACHER,
      isVerified: true,
      profile: {
        create: {
          bio: "Algorithms and Data Structures lecturer",
          skills: ["Algorithms", "C++", "Python"],
          department: "CSE",
        },
      },
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      supabaseId: "seed-teacher-002",
      email: "teacher2@rankroom.dev",
      name: "Prof. Bob Johnson",
      role: Role.TEACHER,
      isVerified: true,
      profile: {
        create: {
          bio: "Systems Programming lecturer",
          skills: ["C", "Systems", "Linux"],
          department: "CSE",
        },
      },
    },
  });

  // Create Batches
  const batch1 = await prisma.batch.create({
    data: {
      name: "CSE 2024 - Section A",
      year: 2024,
      semester: 3,
      departmentId: dept.id,
      teacherId: teacher1.id,
    },
  });

  const batch2 = await prisma.batch.create({
    data: {
      name: "CSE 2024 - Section B",
      year: 2024,
      semester: 3,
      departmentId: dept.id,
      teacherId: teacher2.id,
    },
  });

  // Create Students
  const studentData = [
    { name: "Charlie Brown", email: "charlie@rankroom.dev", supabaseId: "seed-student-001", batch: batch1 },
    { name: "Diana Prince", email: "diana@rankroom.dev", supabaseId: "seed-student-002", batch: batch1 },
    { name: "Ethan Hunt", email: "ethan@rankroom.dev", supabaseId: "seed-student-003", batch: batch1 },
    { name: "Fiona Green", email: "fiona@rankroom.dev", supabaseId: "seed-student-004", batch: batch2 },
    { name: "George Mills", email: "george@rankroom.dev", supabaseId: "seed-student-005", batch: batch2 },
  ];

  const students = await Promise.all(
    studentData.map(async (s) => {
      const student = await prisma.user.create({
        data: {
          supabaseId: s.supabaseId,
          email: s.email,
          name: s.name,
          role: Role.STUDENT,
          isVerified: true,
          profile: {
            create: {
              department: "CSE",
              skills: ["Programming"],
            },
          },
          leaderboard: {
            create: {},
          },
        },
      });
      await prisma.enrollment.create({
        data: { studentId: student.id, batchId: s.batch.id },
      });
      return student;
    })
  );

  // Create Subjects
  const subject1 = await prisma.subject.create({
    data: {
      name: "Data Structures & Algorithms",
      code: "CSE301",
      batchId: batch1.id,
      departmentId: dept.id,
      teacherId: teacher1.id,
    },
  });

  const subject2 = await prisma.subject.create({
    data: {
      name: "Operating Systems",
      code: "CSE302",
      batchId: batch1.id,
      departmentId: dept.id,
      teacherId: teacher1.id,
    },
  });

  // Create Problems
  const problem1 = await prisma.problem.create({
    data: {
      title: "Two Sum",
      slug: "two-sum",
      description: `## Problem

Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to* \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.

## Examples

**Example 1:**
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`
`,
      difficulty: Difficulty.EASY,
      tags: ["array", "hash-table"],
      constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
      inputFormat: "First line: space-separated integers\nSecond line: target integer",
      outputFormat: "Space-separated indices",
      sampleInput: "2 7 11 15\n9",
      sampleOutput: "0 1",
      createdById: admin.id,
      isPublished: true,
      points: 10,
      testCases: {
        create: [
          { input: "2 7 11 15\n9", expectedOutput: "0 1", isSample: true },
          { input: "3 2 4\n6", expectedOutput: "1 2", isSample: true },
          { input: "3 3\n6", expectedOutput: "0 1", isHidden: true },
        ],
      },
    },
  });

  const problem2 = await prisma.problem.create({
    data: {
      title: "Longest Substring Without Repeating Characters",
      slug: "longest-substring-without-repeating",
      description: `## Problem

Given a string \`s\`, find the length of the **longest substring** without repeating characters.

## Examples

**Example 1:**
\`\`\`
Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.
\`\`\`

**Example 2:**
\`\`\`
Input: s = "bbbbb"
Output: 1
\`\`\`
`,
      difficulty: Difficulty.MEDIUM,
      tags: ["string", "sliding-window", "hash-table"],
      constraints: "0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.",
      inputFormat: "Single line string",
      outputFormat: "Single integer",
      sampleInput: "abcabcbb",
      sampleOutput: "3",
      createdById: admin.id,
      isPublished: true,
      points: 25,
      testCases: {
        create: [
          { input: "abcabcbb", expectedOutput: "3", isSample: true },
          { input: "bbbbb", expectedOutput: "1", isSample: true },
          { input: "pwwkew", expectedOutput: "3", isHidden: true },
          { input: "", expectedOutput: "0", isHidden: true },
        ],
      },
    },
  });

  const problem3 = await prisma.problem.create({
    data: {
      title: "Median of Two Sorted Arrays",
      slug: "median-of-two-sorted-arrays",
      description: `## Problem

Given two sorted arrays \`nums1\` and \`nums2\` of size \`m\` and \`n\` respectively, return **the median** of the two sorted arrays.

The overall run time complexity should be \`O(log (m+n))\`.

## Examples

**Example 1:**
\`\`\`
Input: nums1 = [1,3], nums2 = [2]
Output: 2.00000
\`\`\`

**Example 2:**
\`\`\`
Input: nums1 = [1,2], nums2 = [3,4]
Output: 2.50000
\`\`\`
`,
      difficulty: Difficulty.HARD,
      tags: ["array", "binary-search", "divide-and-conquer"],
      constraints: "nums1.length == m\nnums2.length == n\n0 <= m <= 1000\n0 <= n <= 1000",
      inputFormat: "Line 1: nums1\nLine 2: nums2",
      outputFormat: "Float with 5 decimal places",
      sampleInput: "1 3\n2",
      sampleOutput: "2.00000",
      createdById: admin.id,
      isPublished: true,
      points: 50,
      testCases: {
        create: [
          { input: "1 3\n2", expectedOutput: "2.00000", isSample: true },
          { input: "1 2\n3 4", expectedOutput: "2.50000", isSample: true },
          { input: "0 0\n0 0", expectedOutput: "0.00000", isHidden: true },
        ],
      },
    },
  });

  // Create an Assignment
  await prisma.assignment.create({
    data: {
      title: "Implement Binary Search Tree",
      description: "Implement a BST with insert, delete, and search operations. Submit a zip file with your code.",
      subjectId: subject1.id,
      teacherId: teacher1.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      maxScore: 100,
    },
  });

  // Create a Contest
  const contest = await prisma.contest.create({
    data: {
      title: "Weekly Coding Challenge #1",
      description: "# Weekly Challenge\n\nTest your skills with these problems. Good luck!",
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      endTime: new Date(Date.now() + 27 * 60 * 60 * 1000), // tomorrow + 3h
      type: "PUBLIC",
      status: "UPCOMING",
      createdById: admin.id,
      rules: "Standard contest rules apply. No plagiarism.",
      problems: {
        create: [
          { problemId: problem1.id, order: 1, points: 100 },
          { problemId: problem2.id, order: 2, points: 200 },
          { problemId: problem3.id, order: 3, points: 300 },
        ],
      },
    },
  });

  // Register all students for the contest
  await Promise.all(
    students.map((s) =>
      prisma.contestRegistration.create({
        data: { contestId: contest.id, userId: s.id },
      })
    )
  );

  console.log("✅ Seed complete!");
  console.log(`   👤 Admin: ${admin.email}`);
  console.log(`   👤 Teacher 1: ${teacher1.email}`);
  console.log(`   👤 Teacher 2: ${teacher2.email}`);
  console.log(`   👥 Students: ${students.map((s) => s.email).join(", ")}`);
  console.log(`   📚 Subjects: ${subject1.name}, ${subject2.name}`);
  console.log(`   💻 Problems: ${problem1.title}, ${problem2.title}, ${problem3.title}`);
  console.log(`   🏆 Contest: ${contest.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
