import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}

export function formatMemory(kb?: number | null, ...args: any[]): string {
  if (kb === undefined || kb === null) return "0 KB";
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatRuntime(ms?: number | null, ...args: any[]): string {
  if (ms === undefined || ms === null) return "0 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatPoints(points: number): string {
  return new Intl.NumberFormat('en-US').format(points) + " pts";
}

export function formatRoleLabel(role?: string | null): string {
  if (!role) return "";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function getDifficultyColor(difficulty: string): "default" | "secondary" | "destructive" | "outline" {
  const diff = difficulty.toLowerCase();
  if (diff === "easy") return "secondary";
  if (diff === "medium") return "default";
  if (diff === "hard") return "destructive";
  return "outline";
}

export function getInitials(name: string): string {
  if (!name) return "?";
  return name.substring(0, 2).toUpperCase();
}
