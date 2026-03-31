import type { NextFunction, Request, Response } from "express";
import * as attendanceService from "../services/attendance.service";

export async function createAttendanceSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attendanceService.createOrUpdateAttendanceSession(null, req.user!.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateAttendanceSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attendanceService.createOrUpdateAttendanceSession(req.params.sessionId, req.user!.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAttendanceSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attendanceService.getAttendanceSession(req.params.sessionId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getStudentAttendanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attendanceService.getStudentAttendance(req.params.studentId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getSectionSubjectSummaryController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attendanceService.getSectionSubjectSummary(req.params.sectionId, req.params.subjectId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getLowAttendanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await attendanceService.getLowAttendance(req.params.sectionId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
