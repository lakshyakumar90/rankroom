import "dotenv/config";

import { prisma } from "@repo/database";
import { Role } from "@repo/types";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { ensureUniqueHandle } from "../lib/handles";

type DemoUser = {
  email: string;
  name: string;
  role: Role;
  password: string;
};

const defaultPassword = process.env["DEMO_USER_DEFAULT_PASSWORD"] ?? "RankRoom123!";

const demoUsers: DemoUser[] = [
  { email: "admin@rankroom.dev", name: "Admin User", role: Role.ADMIN, password: defaultPassword },
  { email: "depthead@rankroom.dev", name: "Dr. Maya Department", role: Role.DEPARTMENT_HEAD, password: defaultPassword },
  { email: "teacher1@rankroom.dev", name: "Dr. Alice Smith", role: Role.TEACHER, password: defaultPassword },
  { email: "teacher2@rankroom.dev", name: "Prof. Bob Johnson", role: Role.TEACHER, password: defaultPassword },
  { email: "cc.sectiona@rankroom.dev", name: "Asha Coordinator", role: Role.CLASS_COORDINATOR, password: defaultPassword },
  { email: "cc.sectionb@rankroom.dev", name: "Rohan Coordinator", role: Role.CLASS_COORDINATOR, password: defaultPassword },
  { email: "charlie@rankroom.dev", name: "Charlie Brown", role: Role.STUDENT, password: defaultPassword },
  { email: "diana@rankroom.dev", name: "Diana Prince", role: Role.STUDENT, password: defaultPassword },
  { email: "ethan@rankroom.dev", name: "Ethan Hunt", role: Role.STUDENT, password: defaultPassword },
  { email: "fiona@rankroom.dev", name: "Fiona Green", role: Role.STUDENT, password: defaultPassword },
  { email: "george@rankroom.dev", name: "George Mills", role: Role.STUDENT, password: defaultPassword },
];

async function listAllAuthUsers() {
  const users: SupabaseAuthUser[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    users.push(...data.users);
    if (data.users.length < 200) break;
    page += 1;
  }

  return users;
}

async function ensureAuthUser(demoUser: DemoUser, authUsers: Awaited<ReturnType<typeof listAllAuthUsers>>) {
  const existing = authUsers.find((entry) => entry.email?.toLowerCase() === demoUser.email.toLowerCase());
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      email: demoUser.email,
      password: demoUser.password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        name: demoUser.name,
        full_name: demoUser.name,
        role: demoUser.role,
      },
    });

    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: demoUser.email,
    password: demoUser.password,
    email_confirm: true,
    user_metadata: {
      name: demoUser.name,
      full_name: demoUser.name,
      role: demoUser.role,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Failed to create auth user for ${demoUser.email}`);
  }

  return data.user.id;
}

async function ensureDatabaseUser(demoUser: DemoUser, supabaseId: string) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: demoUser.email }, { supabaseId }],
    },
    include: {
      profile: true,
      leaderboard: true,
    },
  });

  const handle = existing?.profile?.handle ?? (await ensureUniqueHandle(demoUser.name, undefined, existing?.id));

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        supabaseId,
        email: demoUser.email,
        name: demoUser.name,
        role: demoUser.role,
        isVerified: true,
        profile: existing.profile
          ? {
              update: {
                handle,
              },
            }
          : {
              create: {
                handle,
                skills: [],
              },
            },
        ...(demoUser.role === Role.STUDENT && !existing.leaderboard ? { leaderboard: { create: {} } } : {}),
      },
    });

    return;
  }

  await prisma.user.create({
    data: {
      supabaseId,
      email: demoUser.email,
      name: demoUser.name,
      role: demoUser.role,
      isVerified: true,
      profile: {
        create: {
          handle,
          skills: [],
        },
      },
      ...(demoUser.role === Role.STUDENT ? { leaderboard: { create: {} } } : {}),
    },
  });
}

async function main() {
  console.log("Provisioning demo users...");
  console.log(`Default password: ${defaultPassword}`);

  const authUsers = await listAllAuthUsers();

  for (const demoUser of demoUsers) {
    const supabaseId = await ensureAuthUser(demoUser, authUsers);
    await ensureDatabaseUser(demoUser, supabaseId);
    console.log(`  synced ${demoUser.role.padEnd(18)} ${demoUser.email}`);
  }

  console.log("Demo users are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
