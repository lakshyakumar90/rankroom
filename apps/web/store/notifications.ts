"use client";

import { create } from "zustand";
import type { Notification } from "@repo/types";

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  setNotifications: (items: Notification[], unreadCount?: number) => void;
  prependNotification: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  setNotifications: (items, unreadCount) =>
    set({
      items,
      unreadCount:
        unreadCount ?? items.filter((notification) => !notification.isRead).length,
    }),
  prependNotification: (notification) =>
    set((state) => {
      const existing = state.items.find((item) => item.id === notification.id);
      const items = existing
        ? state.items.map((item) => (item.id === notification.id ? notification : item))
        : [notification, ...state.items].slice(0, 20);

      return {
        items,
        unreadCount: existing
          ? state.unreadCount
          : state.unreadCount + (notification.isRead ? 0 : 1),
      };
    }),
  markRead: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, isRead: true } : item
      ),
      unreadCount: Math.max(
        0,
        state.items.some((item) => item.id === id && !item.isRead)
          ? state.unreadCount - 1
          : state.unreadCount
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0,
    })),
  clear: () => set({ items: [], unreadCount: 0 }),
}));
