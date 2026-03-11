import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "./logger";

let io: SocketIOServer;

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

    // Join a contest room
    socket.on("contest:join", ({ contestId }: { contestId: string }) => {
      socket.join(`contest:${contestId}`);
      logger.debug({ socketId: socket.id, contestId }, "Joined contest room");
    });

    // Leave a contest room
    socket.on("contest:leave", ({ contestId }: { contestId: string }) => {
      socket.leave(`contest:${contestId}`);
      logger.debug({ socketId: socket.id, contestId }, "Left contest room");
    });

    // Join user-specific room for submission verdicts
    socket.on("user:join", ({ userId }: { userId: string }) => {
      socket.join(`user:${userId}`);
      logger.debug({ socketId: socket.id, userId }, "Joined user room");
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Client disconnected");
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

// Emit submission verdict to a user
export function emitSubmissionVerdict(
  userId: string,
  payload: { submissionId: string; status: string; verdict?: unknown }
) {
  getIO().to(`user:${userId}`).emit("submission:verdict", payload);
}

// Emit contest standing update to all users in a contest room
export function emitContestStandingUpdate(
  contestId: string,
  standings: unknown[]
) {
  getIO().to(`contest:${contestId}`).emit("contest:standing_update", { contestId, standings });
}
