import type { Request, Response, NextFunction } from "express";
import * as departmentService from "../services/department.service";

export async function listDepartmentsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await departmentService.listDepartments();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createDepartmentController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await departmentService.createDepartment(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateDepartmentController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await departmentService.updateDepartment(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteDepartmentController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await departmentService.deleteDepartment(req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function departmentSectionsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await departmentService.getDepartmentSections(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function departmentMembersController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await departmentService.getDepartmentMembers(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function departmentAnalyticsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await departmentService.getDepartmentAnalytics(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function departmentLeaderboardController(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const data = await departmentService.getDepartmentLeaderboard(req.params.id, search);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
