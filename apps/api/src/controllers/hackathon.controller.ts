import type { NextFunction, Request, Response } from "express";
import * as hackathonService from "../services/hackathon.service";

export async function listHackathonsController(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const data = await hackathonService.listHackathons(req.user, status);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getHackathonController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await hackathonService.getHackathon(req.user, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createHackathonController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await hackathonService.createHackathon(req.user!, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateHackathonController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await hackathonService.updateHackathon(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteHackathonController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await hackathonService.deleteHackathon(req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function registerHackathonController(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = typeof req.body?.teamId === "string" ? req.body.teamId : undefined;
    const data = await hackathonService.registerForHackathon(req.params.id, req.user!.id, teamId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function hackathonRegistrationsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await hackathonService.getHackathonRegistrations(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createHackathonTeamController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await hackathonService.createHackathonTeam(req.params.id, req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateHackathonTeamController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await hackathonService.updateHackathonTeam(req.params.id, req.params.teamId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function notifyHackathonController(req: Request, res: Response, next: NextFunction) {
  try {
    const title = typeof req.body?.title === "string" ? req.body.title : "Hackathon update";
    const message = typeof req.body?.message === "string" ? req.body.message : "A hackathon update is available.";
    const data = await hackathonService.notifyEligibleStudents(req.user!, req.params.id, title, message);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function hackathonEligibilityController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await hackathonService.computeHackathonEligibility(req.params.id, req.params.userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
