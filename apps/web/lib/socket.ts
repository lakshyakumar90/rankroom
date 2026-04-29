"use client";

import { io, type Socket } from "socket.io-client";
import { createClient } from "./supabase/client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(process.env["NEXT_PUBLIC_SOCKET_URL"] ?? "http://localhost:4000", {
    autoConnect: false,
    transports: ["websocket"],
  });

  return socket;
}

export async function syncSocketAuthToken(): Promise<Socket> {
  const socket = getSocket();
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  socket.auth = { token: session?.access_token ?? undefined };
  return socket;
}
