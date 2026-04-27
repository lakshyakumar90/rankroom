import { Router, type Request, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { authenticate, optionalAuth } from "../middleware/auth";
import { requirePermission, requireScope } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/error";
import {
  createHackathonSchema,
  createHackathonTeamSchema,
  upsertHackathonWinnersSchema,
  updateHackathonSchema,
  updateHackathonTeamSchema,
} from "@repo/validators";
import {
  createHackathonController,
  createHackathonTeamController,
  deleteHackathonController,
  getHackathonController,
  hackathonEligibilityController,
  hackathonRegistrationsController,
  listHackathonsController,
  notifyHackathonController,
  registerHackathonController,
  upsertHackathonWinnersController,
  updateHackathonController,
  updateHackathonTeamController,
} from "../controllers/hackathon.controller";
import {
  buildHackathonViewerPayload,
} from "../services/event-registration.service";
import { z } from "zod";

const router: ExpressRouter = Router();

async function getHackathonScopeResource(req: Request) {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    select: { createdById: true, departmentId: true },
  });

  return { ownerId: hackathon?.createdById, departmentId: hackathon?.departmentId };
}

router.get("/", optionalAuth, listHackathonsController);
// GET /:id — role-aware viewer payload
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    if (req.user) {
      const payload = await buildHackathonViewerPayload(req.params.id, req.user);
      return res.json({ success: true, data: payload });
    }
    return getHackathonController(req, res, next);
  } catch (err) { next(err); }
});
router.post("/", authenticate, requirePermission("hackathons:create"), validate(createHackathonSchema), createHackathonController);
router.put(
  "/:id",
  authenticate,
  requirePermission("hackathons:update"),
  requireScope(async (req) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { createdById: true, departmentId: true },
    });
    return { ownerId: hackathon?.createdById, departmentId: hackathon?.departmentId };
  }),
  validate(updateHackathonSchema),
  updateHackathonController
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("hackathons:delete"),
  requireScope(async (req) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { createdById: true, departmentId: true },
    });
    return { ownerId: hackathon?.createdById, departmentId: hackathon?.departmentId };
  }),
  deleteHackathonController
);
router.post("/:id/register", authenticate, requirePermission("hackathons:register"), registerHackathonController);
router.put(
  "/:id/winners",
  authenticate,
  requirePermission("hackathons:update"),
  requireScope(getHackathonScopeResource),
  validate(upsertHackathonWinnersSchema),
  upsertHackathonWinnersController
);
router.get(
  "/:id/registrations",
  authenticate,
  requireScope(async (req) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { createdById: true, departmentId: true },
    });
    return { ownerId: hackathon?.createdById, departmentId: hackathon?.departmentId };
  }),
  hackathonRegistrationsController
);
// ── Legacy hackathon team routes (kept for backward compat) ───────────────────
router.post("/:id/teams/legacy", authenticate, requirePermission("hackathons:register"), validate(createHackathonTeamSchema), createHackathonTeamController);
router.put("/:id/teams/legacy/:teamId", authenticate, requirePermission("hackathons:register"), validate(updateHackathonTeamSchema), updateHackathonTeamController);

// ── New event team routes ──────────────────────────────────────────────────────
const createTeamSchema = z.object({ body: z.object({ name: z.string().min(1).max(60) }) });
const joinRequestSchema = z.object({ body: z.object({ message: z.string().max(200).optional() }) });
const inviteSchema = z.object({ body: z.object({ invitedId: z.string().min(1) }) });
const transferSchema = z.object({ body: z.object({ newLeaderId: z.string().min(1) }) });

router.all("/:id/event-teams", authenticate, async (_req, _res, next) => next(new AppError("Hackathon team flows are disabled for offline registration events", 410)));
router.all("/:id/event-teams/:teamId/join-requests", authenticate, async (_req, _res, next) => next(new AppError("Hackathon team flows are disabled for offline registration events", 410)));
router.all("/:id/event-teams/:teamId/join-requests/:requestId/approve", authenticate, async (_req, _res, next) => next(new AppError("Hackathon team flows are disabled for offline registration events", 410)));
router.all("/:id/event-teams/:teamId/join-requests/:requestId/reject", authenticate, async (_req, _res, next) => next(new AppError("Hackathon team flows are disabled for offline registration events", 410)));
router.all("/:id/event-teams/:teamId/invites", authenticate, async (_req, _res, next) => next(new AppError("Hackathon team flows are disabled for offline registration events", 410)));
router.all("/:id/event-teams/invites/:inviteId/accept", authenticate, async (_req, _res, next) => next(new AppError("Hackathon team flows are disabled for offline registration events", 410)));
router.all("/:id/event-teams/:teamId/transfer-leadership", authenticate, async (_req, _res, next) => next(new AppError("Hackathon team flows are disabled for offline registration events", 410)));
router.post(
  "/:id/winners",
  authenticate,
  requirePermission("hackathons:update"),
  requireScope(async (req) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { createdById: true, departmentId: true },
    });
    return { ownerId: hackathon?.createdById, departmentId: hackathon?.departmentId };
  }),
  validate(upsertHackathonWinnersSchema),
  upsertHackathonWinnersController
);
router.post(
  "/:id/notify",
  authenticate,
  requirePermission("hackathons:update"),
  requireScope(async (req) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { createdById: true, departmentId: true },
    });
    return { ownerId: hackathon?.createdById, departmentId: hackathon?.departmentId };
  }),
  notifyHackathonController
);
router.get("/:id/eligibility/:userId", optionalAuth, hackathonEligibilityController);

// DSA Phase: problem management for hackathons
// POST /api/hackathons/:id/problems
router.post(
  "/:id/problems",
  authenticate,
  requirePermission("hackathons:update"),
  requireScope(getHackathonScopeResource),
  async (req, res, next) => {
  try {
    const { problemId, points, order } = req.body as { problemId: string; points?: number; order?: number };
    if (!problemId) throw new AppError("problemId is required", 400);

    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { id: true, type: true },
    });
    if (!hackathon) throw new AppError("Hackathon not found", 404);

    const existing = await prisma.hackathonProblem.findUnique({
      where: { hackathonId_problemId: { hackathonId: req.params.id, problemId } },
    });
    if (existing) throw new AppError("Problem already added to this hackathon", 409);

    const hp = await prisma.hackathonProblem.create({
      data: {
        hackathonId: req.params.id,
        problemId,
        points: points ?? 100,
        order: order ?? 0,
      },
      include: { problem: { select: { id: true, title: true, slug: true, difficulty: true } } },
    });

    res.status(201).json({ success: true, data: hp });
  } catch (err) {
    next(err);
  }
  }
);

// DELETE /api/hackathons/:id/problems/:problemId
router.delete(
  "/:id/problems/:problemId",
  authenticate,
  requirePermission("hackathons:update"),
  requireScope(getHackathonScopeResource),
  async (req, res, next) => {
  try {
    await prisma.hackathonProblem.delete({
      where: { hackathonId_problemId: { hackathonId: req.params.id, problemId: req.params.problemId } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
  }
);

// GET /api/hackathons/:id/standings
router.get("/:id/standings", optionalAuth, async (req, res, next) => {
  try {
    const standings = await prisma.hackathonStanding.findMany({
      where: { hackathonId: req.params.id },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: [{ rank: "asc" }, { totalScore: "desc" }],
    });
    res.json({ success: true, data: standings });
  } catch (err) {
    next(err);
  }
});

export default router;
