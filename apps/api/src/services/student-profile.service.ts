import { prisma } from "@repo/database";
import { Role, type JWTPayload } from "@repo/types";
import { AppError } from "../middleware/error";
import { supabase } from "../lib/supabase";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  githubUsername: true,
  createdAt: true,
} as const;

function canViewPrivateProfile(viewer: JWTPayload | undefined, targetUserId: string) {
  if (!viewer) return false;
  if (viewer.id === targetUserId) return true;
  return [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR].includes(viewer.role);
}

export async function ensureStudentProfile(userId: string) {
  const existing = await prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      skills: true,
      projects: true,
      achievements: true,
    },
  });

  if (existing) return existing;

  return prisma.studentProfile.create({
    data: { userId },
    include: {
      skills: true,
      projects: true,
      achievements: true,
    },
  });
}

export async function getStudentProfile(viewer: JWTPayload | undefined, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...publicUserSelect,
      profile: true,
      studentProfile: {
        include: {
          skills: true,
          projects: true,
          achievements: true,
        },
      },
      leaderboard: true,
      enrollments: {
        select: {
          section: {
            select: {
              id: true,
              name: true,
              code: true,
              semester: true,
              academicYear: true,
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
    },
  });

  if (!user) throw new AppError("Profile not found", 404);

  const studentProfile = user.studentProfile ?? (await ensureStudentProfile(user.id));
  const allowedPrivate = canViewPrivateProfile(viewer, user.id);
  const isPublic = studentProfile.isPublic || user.profile?.isPublic;

  if (!isPublic && !allowedPrivate) {
    throw new AppError("Profile not found", 404);
  }

  if (allowedPrivate) {
    return { ...user, studentProfile };
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    githubUsername: user.githubUsername,
    createdAt: user.createdAt,
    profile: {
      handle: user.profile?.handle ?? null,
      isPublic: isPublic,
    },
    studentProfile: {
      ...studentProfile,
      resumeUrl: isPublic ? studentProfile.resumeUrl : null,
      resumeFilename: isPublic ? studentProfile.resumeFilename : null,
      projects: studentProfile.projects,
      achievements: studentProfile.achievements,
      skills: studentProfile.skills,
      activityHeatmap: studentProfile.activityHeatmap,
    },
    leaderboard: user.leaderboard,
    enrollments: user.enrollments,
  };
}

export async function updateOwnStudentProfile(user: JWTPayload, data: Record<string, unknown>) {
  const profile = await ensureStudentProfile(user.id);
  const nextGithub = typeof data.githubUsername === "string" ? data.githubUsername : undefined;

  if (nextGithub !== undefined) {
    await prisma.user.update({
      where: { id: user.id },
      data: { githubUsername: nextGithub || null },
    });
  }

  return prisma.studentProfile.update({
    where: { id: profile.id },
    data: {
      ...(data.bio !== undefined ? { bio: data.bio as string | null } : {}),
      ...(data.leetcodeUsername !== undefined ? { leetcodeUsername: data.leetcodeUsername as string | null } : {}),
      ...(data.githubUsername !== undefined ? { githubUsername: data.githubUsername as string | null } : {}),
      ...(data.codechefUsername !== undefined ? { codechefUsername: data.codechefUsername as string | null } : {}),
      ...(data.codeforcesUsername !== undefined ? { codeforcesUsername: data.codeforcesUsername as string | null } : {}),
      ...(data.hackerrankUsername !== undefined ? { hackerrankUsername: data.hackerrankUsername as string | null } : {}),
      ...(data.cgpa !== undefined ? { cgpa: data.cgpa as number | null } : {}),
      ...(data.isPublic !== undefined ? { isPublic: data.isPublic as boolean } : {}),
    },
    include: {
      skills: true,
      projects: true,
      achievements: true,
    },
  });
}

export async function uploadResume(userId: string, file: Express.Multer.File) {
  const profile = await ensureStudentProfile(userId);
  const filePath = `resumes/${userId}/${Date.now()}_${file.originalname}`;
  const bucket = "resumes";

  const { error } = await supabase.storage.from(bucket).upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: true,
  });

  if (error) {
    throw new AppError("Resume upload failed", 500);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return prisma.studentProfile.update({
    where: { id: profile.id },
    data: {
      resumeUrl: data.publicUrl,
      resumeFilename: file.originalname,
    },
  });
}

export async function deleteResume(userId: string) {
  const profile = await ensureStudentProfile(userId);
  if (profile.resumeUrl) {
    const objectPath = profile.resumeUrl.split("/storage/v1/object/public/resumes/")[1];
    if (objectPath) {
      await supabase.storage.from("resumes").remove([objectPath]);
    }
  }

  return prisma.studentProfile.update({
    where: { id: profile.id },
    data: {
      resumeUrl: null,
      resumeFilename: null,
    },
  });
}

export async function addSkill(userId: string, data: { name: string; category: string; level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" }) {
  const profile = await ensureStudentProfile(userId);
  return prisma.skill.create({
    data: {
      profileId: profile.id,
      name: data.name,
      category: data.category,
      level: data.level,
    },
  });
}

export async function updateSkill(userId: string, skillId: string, data: Partial<{ level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT"; category: string; name: string }>) {
  const profile = await ensureStudentProfile(userId);
  const skill = await prisma.skill.findFirst({ where: { id: skillId, profileId: profile.id } });
  if (!skill) throw new AppError("Skill not found", 404);
  return prisma.skill.update({ where: { id: skillId }, data });
}

export async function removeSkill(userId: string, skillId: string) {
  const profile = await ensureStudentProfile(userId);
  const skill = await prisma.skill.findFirst({ where: { id: skillId, profileId: profile.id } });
  if (!skill) throw new AppError("Skill not found", 404);
  await prisma.skill.delete({ where: { id: skillId } });
  return { success: true };
}

export async function addProject(userId: string, data: { title: string; description: string; techStack: string[]; githubUrl?: string | null; liveUrl?: string | null; imageUrl?: string | null; featured?: boolean }) {
  const profile = await ensureStudentProfile(userId);
  return prisma.project.create({
    data: {
      profileId: profile.id,
      title: data.title,
      description: data.description,
      techStack: data.techStack,
      githubUrl: data.githubUrl ?? null,
      liveUrl: data.liveUrl ?? null,
      imageUrl: data.imageUrl ?? null,
      featured: data.featured ?? false,
    },
  });
}

export async function updateProject(userId: string, projectId: string, data: Record<string, unknown>) {
  const profile = await ensureStudentProfile(userId);
  const project = await prisma.project.findFirst({ where: { id: projectId, profileId: profile.id } });
  if (!project) throw new AppError("Project not found", 404);
  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.title !== undefined ? { title: data.title as string } : {}),
      ...(data.description !== undefined ? { description: data.description as string } : {}),
      ...(data.techStack !== undefined ? { techStack: data.techStack as string[] } : {}),
      ...(data.githubUrl !== undefined ? { githubUrl: data.githubUrl as string | null } : {}),
      ...(data.liveUrl !== undefined ? { liveUrl: data.liveUrl as string | null } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl as string | null } : {}),
      ...(data.featured !== undefined ? { featured: data.featured as boolean } : {}),
    },
  });
}

export async function deleteProject(userId: string, projectId: string) {
  const profile = await ensureStudentProfile(userId);
  const project = await prisma.project.findFirst({ where: { id: projectId, profileId: profile.id } });
  if (!project) throw new AppError("Project not found", 404);
  await prisma.project.delete({ where: { id: projectId } });
  return { success: true };
}

export async function addAchievement(userId: string, data: { title: string; description?: string | null; date: string; category: string; certificateUrl?: string | null }) {
  const profile = await ensureStudentProfile(userId);
  return prisma.achievement.create({
    data: {
      profileId: profile.id,
      title: data.title,
      description: data.description ?? null,
      date: new Date(data.date),
      category: data.category,
      certificateUrl: data.certificateUrl ?? null,
    },
  });
}

export async function updateAchievement(userId: string, achievementId: string, data: Record<string, unknown>) {
  const profile = await ensureStudentProfile(userId);
  const achievement = await prisma.achievement.findFirst({ where: { id: achievementId, profileId: profile.id } });
  if (!achievement) throw new AppError("Achievement not found", 404);
  return prisma.achievement.update({
    where: { id: achievementId },
    data: {
      ...(data.title !== undefined ? { title: data.title as string } : {}),
      ...(data.description !== undefined ? { description: data.description as string | null } : {}),
      ...(data.date !== undefined ? { date: new Date(data.date as string) } : {}),
      ...(data.category !== undefined ? { category: data.category as string } : {}),
      ...(data.certificateUrl !== undefined ? { certificateUrl: data.certificateUrl as string | null } : {}),
    },
  });
}

export async function deleteAchievement(userId: string, achievementId: string) {
  const profile = await ensureStudentProfile(userId);
  const achievement = await prisma.achievement.findFirst({ where: { id: achievementId, profileId: profile.id } });
  if (!achievement) throw new AppError("Achievement not found", 404);
  await prisma.achievement.delete({ where: { id: achievementId } });
  return { success: true };
}

export async function markProfileSynced(userId: string) {
  const profile = await ensureStudentProfile(userId);
  return prisma.studentProfile.update({
    where: { id: profile.id },
    data: {
      lastSyncedAt: new Date(),
    },
    include: {
      skills: true,
      projects: true,
      achievements: true,
    },
  });
}

export async function getHeatmap(userId: string, year?: number) {
  const profile = await ensureStudentProfile(userId);
  const heatmap = (profile.activityHeatmap as Record<string, number>) ?? {};

  if (!year) {
    return heatmap;
  }

  return Object.fromEntries(
    Object.entries(heatmap).filter(([date]) => date.startsWith(`${year}-`))
  );
}
