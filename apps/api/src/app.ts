import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger";
import { errorHandler, notFound } from "./middleware/error";

// Routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import adminRoutes from "./routes/admin";
import attendanceRoutes from "./routes/attendance";
import gradeRoutes from "./routes/grades";
import assignmentRoutes from "./routes/assignments";
import problemRoutes from "./routes/problems";
import submissionRoutes from "./routes/submissions";
import contestRoutes from "./routes/contests";
import departmentRoutes from "./routes/departments";
import sectionRoutes from "./routes/sections";
import profileRoutes from "./routes/profile";
import hackathonRoutes from "./routes/hackathons";
import leaderboardRoutes from "./routes/leaderboard";
import notificationRoutes from "./routes/notifications";
import analyticsRoutes from "./routes/analytics";
import subjectRoutes from "./routes/subjects";
import searchRoutes from "./routes/search";
import languageRoutes from "./routes/languages";
import aiRoutes from "./routes/ai";
import certificateRoutes from "./routes/certificates";
import resultsRoutes from "./routes/results";
import settingsRoutes from "./routes/settings";

export function createApp(): Express {
  const app = express();

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: process.env["FRONTEND_URL"] ?? "http://localhost:3000",
      credentials: true,
    })
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // More strict rate limiting for code execution
  const executeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { success: false, error: "Too many code submissions, please wait" },
  });

  // Logging
  app.use(
    pinoHttp({
      logger,
      quietReqLogger: true,
      autoLogging: {
        ignore: (req) => req.url === "/health",
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "silent";
      },
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    })
  );

  // Body parsing
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/departments", departmentRoutes);
  app.use("/api/sections", sectionRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/grades", gradeRoutes);
  app.use("/api/assignments", assignmentRoutes);
  app.use("/api/problems", executeLimiter, problemRoutes);
  app.use("/api/submissions", submissionRoutes);
  app.use("/api/contests", contestRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/hackathons", hackathonRoutes);
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/subjects", subjectRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/languages", languageRoutes);
  app.use("/api/ai", executeLimiter, aiRoutes);
  app.use("/api/certificates", certificateRoutes);
  app.use("/api/results", resultsRoutes);
  app.use("/api/settings", settingsRoutes);

  // 404 handler
  app.use(notFound);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
