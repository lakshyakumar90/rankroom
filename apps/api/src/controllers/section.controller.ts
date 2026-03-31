import type { NextFunction, Request, Response } from "express";
import * as sectionService from "../services/section.service";

export async function listSectionsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await sectionService.listSections(req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createSectionController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await sectionService.createSection(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateSectionController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await sectionService.updateSection(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteSectionController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await sectionService.deleteSection(req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function sectionStudentsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await sectionService.getSectionStudents(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function sectionTeachersController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await sectionService.getSectionTeachers(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function sectionAttendanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectId = typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
    const data = await sectionService.getSectionAttendanceSummary(req.params.id, subjectId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function sectionLeaderboardController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await sectionService.getSectionLeaderboard(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function sectionAssignmentsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await sectionService.getSectionAssignments(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
