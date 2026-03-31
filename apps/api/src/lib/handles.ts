import { prisma } from "@repo/database";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50);
}

export function fallbackHandle(name: string, userId?: string) {
  const base = slugify(name) || "user";
  if (!userId) return base;

  return `${base}-${userId.slice(-6).toLowerCase()}`;
}

export async function ensureUniqueHandle(name: string, preferred?: string, excludeUserId?: string) {
  const base = slugify(preferred || name) || "user";
  let candidate = base;
  let attempt = 1;

  while (attempt <= 20) {
    const existing = await prisma.profile.findFirst({
      where: {
        handle: candidate,
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      select: { userId: true },
    });

    if (!existing) return candidate;

    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now().toString().slice(-6)}`;
}
