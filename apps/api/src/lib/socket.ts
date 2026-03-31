import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import type { Notification, SubmissionResult } from "@repo/types";
import { logger } from "./logger";

let io: SocketIOServer | null = null;

export function initSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env["FRONTEND_URL"] ?? "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Client connected");

    socket.on("contest:join", ({ contestId }: { contestId: string }) => {
      socket.join(`contest:${contestId}`);
    });

    socket.on("contest:leave", ({ contestId }: { contestId: string }) => {
      socket.leave(`contest:${contestId}`);
    });

    socket.on("user:join", ({ userId }: { userId: string }) => {
      socket.join(`user:${userId}`);
    });

    socket.on("section:join", ({ sectionId }: { sectionId: string }) => {
      socket.join(`section:${sectionId}`);
    });

    socket.on("department:join", ({ departmentId }: { departmentId: string }) => {
      socket.join(`department:${departmentId}`);
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
}

export function emitContestStandingUpdate(contestId: string, standings: unknown[]) {
  getIO().to(`contest:${contestId}`).emit("contest:standing_update", { contestId, standings });
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
