import { Router, type Router as ExpressRouter } from "express";
import { prisma } from "@repo/database";
import { authenticate, optionalAuth } from "../middleware/auth";
import { requirePermission, requireScope } from "../middleware/permissions";
import { validate } from "../middleware/validate";
import {
  createHackathonSchema,
  createHackathonTeamSchema,
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
  updateHackathonController,
  updateHackathonTeamController,
} from "../controllers/hackathon.controller";

const router: ExpressRouter = Router();

router.get("/", optionalAuth, listHackathonsController);
router.get("/:id", optionalAuth, getHackathonController);
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
router.post("/:id/teams", authenticate, requirePermission("hackathons:register"), validate(createHackathonTeamSchema), createHackathonTeamController);
router.put("/:id/teams/:teamId", authenticate, requirePermission("hackathons:register"), validate(updateHackathonTeamSchema), updateHackathonTeamController);
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

export default router;
