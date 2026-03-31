import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { Role } from "@repo/types";
import { authenticate } from "../middleware/auth";

const router: ExpressRouter = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      res.json({ success: true, data: [] });
      return;
    }

    const limit = Math.min(Number.parseInt(String(req.query.limit ?? "5"), 10) || 5, 10);
    const user = req.user!;
    const sectionIds = user.scope.sectionIds;
    const isStudent = user.role === Role.STUDENT;

    const [problems, contests, assignments, users] = await Promise.all([
      prisma.problem.findMany({
        where: {
          isPublished: true,
          OR: [{ title: { contains: q, mode: "insensitive" } }, { tags: { has: q.toLowerCase() } }],
        },
        select: { id: true, title: true, difficulty: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.contest.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
          ...(isStudent ? { OR: [{ sectionId: null }, { sectionId: { in: sectionIds } }] } : {}),
        },
        select: { id: true, title: true, status: true, startTime: true },
        orderBy: { startTime: "desc" },
        take: limit,
      }),
      prisma.assignment.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
          ...(isStudent ? { subject: { sectionId: { in: sectionIds } } } : {}),
        },
        include: { subject: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
        take: limit,
      }),
      prisma.user.findMany({
        where: {
          ...(isStudent
            ? {
                OR: [
                  { enrollments: { some: { sectionId: { in: sectionIds } } } },
                  { teachingAssignments: { some: { sectionId: { in: sectionIds } } } },
                ],
              }
            : {}),
          AND: [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { profile: { is: { handle: { contains: q.toLowerCase(), mode: "insensitive" } } } },
              ],
            },
          ],
        },
        select: { id: true, name: true, email: true, role: true, profile: { select: { handle: true } } },
        orderBy: { name: "asc" },
        take: limit,
      }),
    ]);

    res.json({
      success: true,
      data: [
        ...problems.map((problem) => ({
          id: `problem:${problem.id}`,
          type: "problem",
          title: problem.title,
          subtitle: problem.difficulty,
          href: `/problems/${problem.id}`,
        })),
        ...contests.map((contest) => ({
          id: `contest:${contest.id}`,
          type: "contest",
          title: contest.title,
          subtitle: `${contest.status} · ${contest.startTime.toISOString().slice(0, 10)}`,
          href: `/contests/${contest.id}`,
        })),
        ...assignments.map((assignment) => ({
          id: `assignment:${assignment.id}`,
          type: "assignment",
          title: assignment.title,
          subtitle: `${assignment.subject.name} · due ${assignment.dueDate.toISOString().slice(0, 10)}`,
          href: "/assignments",
        })),
        ...users.map((entry) => ({
          id: `user:${entry.id}`,
          type: "user",
          title: entry.name,
          subtitle: entry.email,
          href: entry.profile?.handle ? `/u/${entry.profile.handle}` : "/profile/edit",
        })),
      ].slice(0, 20),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
