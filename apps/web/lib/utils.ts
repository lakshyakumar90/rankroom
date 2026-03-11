import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatPoints(points: number) {
  if (points >= 1000) return `${(points / 1000).toFixed(1)}k`;
  return points.toString();
}

export function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "EASY": return "text-emerald-500";
    case "MEDIUM": return "text-amber-500";
    case "HARD": return "text-red-500";
    default: return "text-muted-foreground";
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case "ACCEPTED": return "text-emerald-500";
    case "WRONG_ANSWER": return "text-red-500";
    case "TIME_LIMIT_EXCEEDED": return "text-amber-500";
    case "COMPILATION_ERROR": return "text-orange-500";
    case "RUNTIME_ERROR": return "text-red-400";
    case "PENDING": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

export function formatRuntime(ms?: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatMemory(kb?: number | null) {
  if (!kb) return "—";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function getContestStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "LIVE": return "default";
    case "UPCOMING": return "secondary";
    case "ENDED": return "outline";
    default: return "outline";
  }
}
