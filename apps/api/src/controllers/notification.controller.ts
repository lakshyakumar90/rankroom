import type { NextFunction, Request, Response } from "express";
import * as notificationService from "../services/notification.service";

export async function sendNotificationsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await notificationService.sendNotifications(req.user!, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listOwnNotificationsController(req: Request, res: Response, next: NextFunction) {
  try {
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const data = await notificationService.listOwnNotifications(req.user!.id, page, limit);
    res.json({
      success: true,
      data: data.items,
      unreadCount: data.unreadCount,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationReadController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await notificationService.markNotificationRead(req.user!.id, req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsReadController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await notificationService.markAllNotificationsRead(req.user!.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function unreadNotificationCountController(req: Request, res: Response, next: NextFunction) {
  try {
    const unreadCount = await notificationService.getUnreadNotificationCount(req.user!.id);
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
}
