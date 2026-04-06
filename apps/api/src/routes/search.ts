import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { Role } from "@repo/types";
import { authenticate } from "../middleware/auth";

const router: ExpressRouter = Router();
router.use(authenticate);

function hasStaffAccess(role: Role) {
  return [Role.ADMIN, Role.SUPER_ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER].includes(role);
}

router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      res.json({ success: true, data: [] });
      return;
    }

    const limit = Math.min(Number.parseInt(String(req.query.limit ?? "4"), 10) || 4, 8);
    const query = q.toLowerCase();
    const user = req.user!;
    const sectionIds = user.scope.sectionIds;
    const departmentIds = user.scope.departmentIds;
    const isStudent = user.role === Role.STUDENT;
    const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    const isDepartmentHead = user.role === Role.DEPARTMENT_HEAD;
    const isSectionStaff = user.role === Role.CLASS_COORDINATOR || user.role === Role.TEACHER;

    const [problems, contests, assignments, hackathons, subjects, sections, departments, users] = await Promise.all([
      prisma.problem.findMany({
        where: {
          isPublished: true,
          AND: [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { tags: { has: query } },
              ],
            },
            ...(hasStaffAccess(user.role)
              ? []
              : !user
              ? [{ visibility: "GLOBAL" as const }]
              : [
                  {
                    OR: [
                      { visibility: "GLOBAL" },
                      { departmentId: { in: departmentIds } },
                      { classId: { in: sectionIds } },
                    ],
                  },
                ]),
          ],
        },
        select: { id: true, title: true, difficulty: true, tags: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.contest.findMany({
        where: {
          AND: [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            },
            ...(isStudent
              ? [
                  {
                    OR: [
                      { sectionId: null, departmentId: null, audience: { none: {} } },
                      { sectionId: { in: sectionIds }, audience: { none: {} } },
                      { departmentId: { in: departmentIds }, audience: { none: {} } },
                      { audience: { some: { studentId: user.id } } },
                    ],
                  },
                ]
              : isDepartmentHead
              ? [{ OR: [{ departmentId: { in: departmentIds } }, { createdById: user.id }] }]
              : isSectionStaff
              ? [{ OR: [{ sectionId: { in: sectionIds } }, { createdById: user.id }] }]
              : []),
          ],
        },
        select: { id: true, title: true, status: true, startTime: true },
        orderBy: { startTime: "desc" },
        take: limit,
      }),
      prisma.assignment.findMany({
        where: {
          AND: [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            },
            ...(isStudent
              ? [
                  {
                    OR: [
                      { subject: { sectionId: { in: sectionIds } }, audience: { none: {} } },
                      { audience: { some: { studentId: user.id } } },
                    ],
                  },
                ]
              : isDepartmentHead
              ? [{ subject: { departmentId: { in: departmentIds } } }]
              : isSectionStaff
              ? [{ subject: { sectionId: { in: sectionIds } } }]
              : []),
          ],
        },
        include: { subject: { select: { name: true, code: true } } },
        orderBy: { dueDate: "asc" },
        take: limit,
      }),
      prisma.hackathon.findMany({
        where: {
          AND: [
            {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            },
            ...(isStudent
              ? [
                  {
                    OR: [
                      { departmentId: null },
                      { departmentId: { in: departmentIds } },
                      { audience: { some: { studentId: user.id } } },
                    ],
                  },
                ]
              : isDepartmentHead || isSectionStaff
              ? [{ OR: [{ departmentId: null }, { departmentId: { in: departmentIds } }, { createdById: user.id }] }]
              : []),
          ],
        },
        select: { id: true, title: true, status: true, startDate: true },
        orderBy: { startDate: "desc" },
        take: limit,
      }),
      prisma.subject.findMany({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            },
            ...(isStudent
              ? [{ sectionId: { in: sectionIds } }]
              : isDepartmentHead
              ? [{ departmentId: { in: departmentIds } }]
              : isSectionStaff
              ? [{ sectionId: { in: sectionIds } }]
              : []),
          ],
        },
        select: {
          id: true,
          name: true,
          code: true,
          section: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ code: "asc" }, { name: "asc" }],
        take: limit,
      }),
      prisma.section.findMany({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            },
            ...(isStudent || isSectionStaff
              ? [{ id: { in: sectionIds } }]
              : isDepartmentHead
              ? [{ departmentId: { in: departmentIds } }]
              : []),
          ],
        },
        select: {
          id: true,
          name: true,
          code: true,
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: { name: "asc" },
        take: limit,
      }),
      prisma.department.findMany({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            },
            ...(isAdmin ? [] : [{ id: { in: departmentIds } }]),
          ],
        },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
        take: limit,
      }),
      prisma.user.findMany({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { profile: { is: { handle: { contains: q.toLowerCase(), mode: "insensitive" } } } },
              ],
            },
            ...(isAdmin
              ? []
              : isDepartmentHead
              ? [
                  {
                    OR: [
                      { enrollments: { some: { section: { departmentId: { in: departmentIds } } } } },
                      { teachingAssignments: { some: { section: { departmentId: { in: departmentIds } } } } },
                      { departmentHeaded: { is: { id: { in: departmentIds } } } },
                    ],
                  },
                ]
              : isSectionStaff
              ? [
                  {
                    OR: [
                      { enrollments: { some: { sectionId: { in: sectionIds } } } },
                      { teachingAssignments: { some: { sectionId: { in: sectionIds } } } },
                    ],
                  },
                ]
              : [
                  {
                    OR: [
                      { id: user.id },
                      { enrollments: { some: { sectionId: { in: sectionIds } } } },
                      { teachingAssignments: { some: { sectionId: { in: sectionIds } } } },
                    ],
                  },
                ]),
          ],
        },
        select: { id: true, name: true, email: true, role: true, profile: { select: { handle: true } } },
        orderBy: { name: "asc" },
        take: limit,
      }),
    ]);

    const departmentHref = (departmentId: string) => {
      if (isAdmin) return `/admin/departments/${departmentId}`;
      if (isDepartmentHead) return "/department/overview";
      return "/dashboard";
    };

    const userHref = (entry: { id: string; profile: { handle: string | null } | null }) => {
      if (entry.profile?.handle) return `/u/${entry.profile.handle}`;
      if (entry.id === user.id) return "/settings";
      return isAdmin ? "/admin/users" : "/dashboard";
    };

    res.json({
      success: true,
      data: [
        ...problems.map((problem) => ({
          id: `problem:${problem.id}`,
          type: "problem",
          title: problem.title,
          subtitle: `${problem.difficulty}${problem.tags.length ? ` · ${problem.tags.slice(0, 2).join(", ")}` : ""}`,
          href: `/problems/${problem.id}`,
        })),
        ...contests.map((contest) => ({
          id: `contest:${contest.id}`,
          type: "contest",
          title: contest.title,
          subtitle: `${contest.status} · ${contest.startTime.toISOString().slice(0, 10)}`,
          href: `/contests/${contest.id}`,
        })),
        ...hackathons.map((hackathon) => ({
          id: `hackathon:${hackathon.id}`,
          type: "hackathon",
          title: hackathon.title,
          subtitle: `${hackathon.status} · ${hackathon.startDate.toISOString().slice(0, 10)}`,
          href: `/hackathons/${hackathon.id}`,
        })),
        ...assignments.map((assignment) => ({
          id: `assignment:${assignment.id}`,
          type: "assignment",
          title: assignment.title,
          subtitle: `${assignment.subject.code} · ${assignment.subject.name}`,
          href: `/assignments/${assignment.id}`,
        })),
        ...subjects.map((subject) => ({
          id: `subject:${subject.id}`,
          type: "subject",
          title: `${subject.code} · ${subject.name}`,
          subtitle: `${subject.section.code} · ${subject.section.name}`,
          href: isAdmin ? `/admin/classes` : "/dashboard",
        })),
        ...sections.map((section) => ({
          id: `section:${section.id}`,
          type: "section",
          title: `${section.code} · ${section.name}`,
          subtitle: `${section.department.code} · ${section.department.name}`,
          href: isAdmin ? "/admin/sections" : `/sections/${section.id}`,
        })),
        ...departments.map((department) => ({
          id: `department:${department.id}`,
          type: "department",
          title: `${department.code} · ${department.name}`,
          subtitle: "Department",
          href: departmentHref(department.id),
        })),
        ...users.map((entry) => ({
          id: `user:${entry.id}`,
          type: "user",
          title: entry.name,
          subtitle: entry.email,
          href: userHref(entry),
        })),
      ].slice(0, 30),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
