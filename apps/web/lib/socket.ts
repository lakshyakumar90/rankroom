"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(process.env["NEXT_PUBLIC_SOCKET_URL"] ?? "http://localhost:4000", {
    autoConnect: false,
    transports: ["websocket"],
  });

  return socket;
}
