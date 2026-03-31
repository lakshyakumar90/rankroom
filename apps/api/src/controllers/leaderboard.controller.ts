import type { NextFunction, Request, Response } from "express";
import * as leaderboardService from "../services/leaderboard.service";

function parseFilter(value: unknown): "overall" | "coding" | "academic" | "profile" | "external" {
  if (
    value === "coding" ||
    value === "academic" ||
    value === "profile" ||
    value === "external"
  ) {
    return value;
  }

  return "overall";
}

export async function sectionLeaderboardController(req: Request, res: Response, next: NextFunction) {
  try {
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const filter = parseFilter(req.query.filter);
    const data = await leaderboardService.getSectionLeaderboard(req.params.sectionId, filter, search, page, limit);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function departmentLeaderboardController(req: Request, res: Response, next: NextFunction) {
  try {
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const filter = parseFilter(req.query.filter);
    const data = await leaderboardService.getDepartmentLeaderboard(req.params.departmentId, filter, search, page, limit);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function platformLeaderboardController(req: Request, res: Response, next: NextFunction) {
  try {
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const data = await leaderboardService.getPlatformLeaderboard(page, limit);
    res.json({ success: true, data: data.items, pagination: data.pagination });
  } catch (error) {
    next(error);
  }
}

export async function recomputeLeaderboardController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await leaderboardService.recomputeSectionLeaderboard(req.params.sectionId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function insightsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await leaderboardService.getLeaderboardInsights(req.params.sectionId);
    res.json(data);
  } catch (error) {
    next(error);
  }
}
