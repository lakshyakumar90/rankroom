import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import type { Notification, SubmissionResult } from "@repo/types";
import { logger } from "./logger";
import { authenticateToken } from "../middleware/auth";
import { canUserAccessDepartment, canUserAccessSection } from "../services/scope.service";

let io: SocketIOServer | null = null;

export function initSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env["FRONTEND_URL"] ?? "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const authToken = socket.handshake.auth?.["token"];
    const headerToken = socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");
    const token = typeof authToken === "string" ? authToken : headerToken;

    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }

    try {
      const { user } = await authenticateToken(token);
      if (!user?.isActive) {
        next(new Error("Unauthorized"));
        return;
      }

      socket.data.user = user;
      next();
    } catch (error) {
      logger.warn({ err: error }, "Socket authentication failed");
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    logger.debug({ socketId: socket.id, userId: user.id }, "Client connected");
    socket.join(`user:${user.id}`);

    socket.on("contest:join", ({ contestId }: { contestId: string }) => {
      socket.join(`contest:${contestId}`);
    });

    socket.on("contest:leave", ({ contestId }: { contestId: string }) => {
      socket.leave(`contest:${contestId}`);
    });

    socket.on("user:join", ({ userId }: { userId?: string } = {}) => {
      if (userId && userId !== user.id) {
        socket.emit("room:error", { room: "user", error: "Forbidden" });
        return;
      }

      socket.join(`user:${user.id}`);
    });

    socket.on("section:join", ({ sectionId }: { sectionId: string }) => {
      if (!canUserAccessSection(user, sectionId)) {
        socket.emit("room:error", { room: `section:${sectionId}`, error: "Forbidden" });
        return;
      }

      socket.join(`section:${sectionId}`);
    });

    socket.on("department:join", ({ departmentId }: { departmentId: string }) => {
      if (!canUserAccessDepartment(user, departmentId)) {
        socket.emit("room:error", { room: `department:${departmentId}`, error: "Forbidden" });
        return;
      }

      socket.join(`department:${departmentId}`);
    });

    socket.on("submission:join", async ({ submissionId }: { submissionId: string }) => {
      try {
        const { prisma } = await import("@repo/database");
        const submission = await prisma.submission.findUnique({
          where: { id: submissionId },
          select: { userId: true },
        });

        if (!submission || submission.userId !== user.id) {
          socket.emit("room:error", { room: `submission:${submissionId}`, error: "Forbidden" });
          return;
        }

        socket.join(`submission:${submissionId}`);
      } catch (error) {
        logger.warn({ err: error, submissionId }, "Failed to join submission room");
        socket.emit("room:error", { room: `submission:${submissionId}`, error: "Unable to join room" });
      }
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Client disconnected");
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }

  return io;
}

export function emitSubmissionResult(userId: string, payload: SubmissionResult) {
  getIO().to(`user:${userId}`).emit("submission:result", payload);
  getIO().to(`user:${userId}`).emit("verdict:ready", payload);
  getIO().to(`submission:${payload.submissionId}`).emit("submission:result", payload);
  getIO().to(`submission:${payload.submissionId}`).emit("verdict:ready", payload);
}

export function emitContestStandingUpdate(contestId: string, standings: unknown[]) {
  const payload = { contestId, standings };
  getIO().to(`contest:${contestId}`).emit("contest:standing_update", payload);
  getIO().to(`contest:${contestId}`).emit("standing:update", payload);
}

export function emitNotificationToUser(userId: string, notification: Notification) {
  getIO().to(`user:${userId}`).emit("notification:new", notification);
}

export function emitNotificationToSection(sectionId: string, notification: Notification) {
  getIO().to(`section:${sectionId}`).emit("notification:new", notification);
}

export function emitNotificationToDepartment(departmentId: string, notification: Notification) {
  getIO().to(`department:${departmentId}`).emit("notification:new", notification);
}

export function emitLeaderboardUpdated(sectionId: string) {
  getIO().to(`section:${sectionId}`).emit("leaderboard:updated", {
    sectionId,
    updatedAt: new Date().toISOString(),
  });
}
