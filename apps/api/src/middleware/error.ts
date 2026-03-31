import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@repo/database";
import { logger } from "../lib/logger";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error({ err, code: err.code, path: req.path, method: req.method }, "Prisma error");

    if (err.code === "P2002") {
      res.status(409).json({ success: false, error: "A record with this value already exists." });
      return;
    }

    if (err.code === "P2003") {
      res.status(400).json({ success: false, error: "This record references an invalid related item." });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({ success: false, error: "Requested record was not found." });
      return;
    }

    if (err.code === "P2021" || err.code === "P2022") {
      res.status(500).json({
        success: false,
        error: "Database schema is out of date. Run the latest migrations and restart the API.",
      });
      return;
    }
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }

  if (/judge0/i.test(err.message)) {
    logger.error({ err, path: req.path, method: req.method }, "Judge0 error");
    res.status(503).json({
      success: false,
      error: "Judge0 is unavailable. Start the Judge0 service and try again.",
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  res.status(500).json({ success: false, error: "Internal server error" });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
}
