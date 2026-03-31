import { prisma } from "@repo/database";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Role } from "@repo/types";
import { ensureUniqueHandle } from "./handles";

const allowedRoles = new Set<string>(Object.values(Role));

function normalizeRole(value: unknown): Role {
  if (typeof value === "string" && allowedRoles.has(value)) {
    return value as Role;
  }

  return Role.STUDENT;
}

function extractName(user: SupabaseUser) {
  const metadataName =
    typeof user.user_metadata?.["name"] === "string"
      ? user.user_metadata["name"]
      : typeof user.user_metadata?.["full_name"] === "string"
        ? user.user_metadata["full_name"]
        : undefined;

  return metadataName?.trim() || user.email?.split("@")[0] || "RankRoom User";
}

export async function syncSupabaseUserToDatabase(user: SupabaseUser) {
  const existing = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true, studentProfile: true, leaderboard: true },
  });

  const name = extractName(user);
  const role = normalizeRole(user.user_metadata?.["role"]);
  const email = user.email ?? existing?.email;

  if (!email) {
    throw new Error("Supabase user email is missing");
  }

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        name,
        isVerified: !!user.email_confirmed_at,
        profile: existing.profile
          ? undefined
          : { create: { handle: await ensureUniqueHandle(name) } },
        studentProfile:
          role === Role.STUDENT && !existing.studentProfile
            ? { create: { githubUsername: existing.githubUsername ?? undefined } }
            : undefined,
        leaderboard:
          role === Role.STUDENT && !existing.leaderboard
            ? { create: {} }
            : undefined,
        ...(role !== existing.role ? { role } : {}),
      },
      include: { profile: true, studentProfile: true, leaderboard: true },
    });
  }

  const handle = await ensureUniqueHandle(name);

  return prisma.user.create({
    data: {
      supabaseId: user.id,
      email,
      name,
      role,
      isVerified: !!user.email_confirmed_at,
      profile: { create: { handle } },
      ...(role === Role.STUDENT
        ? {
            leaderboard: { create: {} },
            studentProfile: {
              create: {
                githubUsername:
                  typeof user.user_metadata?.["githubUsername"] === "string"
                    ? user.user_metadata["githubUsername"]
                    : undefined,
              },
            },
          }
        : {}),
    },
    include: { profile: true, studentProfile: true, leaderboard: true },
  });
}
