import { prisma } from "@repo/database";
import { Role, type HackathonEligibility, type JWTPayload, type Notification } from "@repo/types";
import { AppError } from "../middleware/error";
import { emitNotificationToUser } from "../lib/socket";

function toNotificationDto(notification: Awaited<ReturnType<typeof prisma.notification.create>>): Notification {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type as Notification["type"],
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    link: notification.link,
    entityId: notification.entityId,
    entityType: notification.entityType,
    targetRole: notification.targetRole as Notification["targetRole"],
    targetSectionId: notification.targetSectionId,
    targetDepartmentId: notification.targetDepartmentId,
    createdAt: notification.createdAt.toISOString(),
  };
}

function generateTeamCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function getStudentDepartmentId(userId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: userId },
    select: {
      section: { select: { departmentId: true } },
    },
  });

  return enrollment?.section.departmentId ?? null;
}

async function getInvitedAudienceIds(hackathonId: string) {
  const rows = await prisma.hackathonAudience.findMany({
    where: { hackathonId },
    select: { studentId: true },
  });

  return rows.map((row) => row.studentId);
}

export async function computeHackathonEligibility(hackathonId: string, userId: string): Promise<HackathonEligibility> {
  const [hackathon, profile, departmentId, invitedStudentIds] = await Promise.all([
    prisma.hackathon.findUnique({ where: { id: hackathonId } }),
    prisma.studentProfile.findUnique({
      where: { userId },
      include: { skills: true, projects: true },
    }),
    getStudentDepartmentId(userId),
    getInvitedAudienceIds(hackathonId),
  ]);

  if (!hackathon) throw new AppError("Hackathon not found", 404);
  if (!profile) {
    return { isEligible: false, reason: "Complete your student profile first" };
  }

  if (invitedStudentIds.length > 0 && !invitedStudentIds.includes(userId)) {
    return { isEligible: false, reason: "This event is restricted to invited students" };
  }

  if (hackathon.departmentId && departmentId !== hackathon.departmentId) {
    return { isEligible: false, reason: "Only students from the target department can register" };
  }

  const normalizedSkillNames = new Set(profile.skills.map((skill) => skill.name.toLowerCase()));
  const missingSkills = hackathon.minSkills.filter((skill) => !normalizedSkillNames.has(skill.toLowerCase()));

  if (hackathon.minSkills.length > 0 && missingSkills.length === hackathon.minSkills.length) {
    return {
      isEligible: false,
      reason: `Requires one of: ${hackathon.minSkills.join(", ")}`,
      missingSkills,
      currentProjects: profile.projects.length,
      currentLeetcode: profile.leetcodeSolved,
      currentCgpa: profile.cgpa ?? null,
    };
  }

  if (profile.projects.length < hackathon.minProjects) {
    return {
      isEligible: false,
      reason: `Requires ${hackathon.minProjects}+ projects`,
      currentProjects: profile.projects.length,
      currentLeetcode: profile.leetcodeSolved,
      currentCgpa: profile.cgpa ?? null,
    };
  }

  if (profile.leetcodeSolved < hackathon.minLeetcode) {
    return {
      isEligible: false,
      reason: `Requires ${hackathon.minLeetcode}+ LeetCode solved`,
      currentProjects: profile.projects.length,
      currentLeetcode: profile.leetcodeSolved,
      currentCgpa: profile.cgpa ?? null,
    };
  }

  if (hackathon.minCgpa !== null && hackathon.minCgpa !== undefined && (profile.cgpa ?? 0) < hackathon.minCgpa) {
    return {
      isEligible: false,
      reason: `Requires ${hackathon.minCgpa}+ CGPA`,
      currentProjects: profile.projects.length,
      currentLeetcode: profile.leetcodeSolved,
      currentCgpa: profile.cgpa ?? null,
    };
  }

  return {
    isEligible: true,
    reason: "Eligible to register",
    currentProjects: profile.projects.length,
    currentLeetcode: profile.leetcodeSolved,
    currentCgpa: profile.cgpa ?? null,
  };
}

export async function listHackathons(viewer?: JWTPayload, status?: string) {
  const departmentIds = viewer?.scope.departmentIds ?? [];
  const where =
    viewer?.role === Role.STUDENT
      ? {
          ...(status ? { status: status as never } : {}),
          OR: [{ departmentId: null }, { departmentId: { in: departmentIds } }],
        }
      : {
          ...(status ? { status: status as never } : {}),
        };

  const hackathons = await prisma.hackathon.findMany({
    where,
    include: {
      department: true,
      createdBy: { select: { id: true, name: true, role: true, avatar: true, email: true } },
      teams: {
        include: {
          members: true,
        },
      },
      _count: { select: { registrations: true, teams: true } },
    },
    orderBy: [{ registrationDeadline: "asc" }, { createdAt: "desc" }],
  });

  if (!viewer || viewer.role !== Role.STUDENT) {
    return hackathons;
  }

  return Promise.all(
    hackathons.map(async (hackathon) => ({
      ...hackathon,
      eligibility: await computeHackathonEligibility(hackathon.id, viewer.id),
    }))
  );
}

export async function getHackathon(viewer: JWTPayload | undefined, hackathonId: string) {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    include: {
      department: true,
      createdBy: { select: { id: true, name: true, email: true, role: true, avatar: true } },
      teams: {
        include: {
          leader: { select: { id: true, name: true, avatar: true, role: true, email: true } },
          members: {
            include: {
              student: { select: { id: true, name: true, avatar: true, role: true, email: true } },
            },
          },
        },
      },
      registrations: {
        include: {
          student: { select: { id: true, name: true, avatar: true, role: true, email: true } },
          team: { select: { id: true, name: true, teamCode: true, rank: true } },
        },
      },
    },
  });

  if (!hackathon) throw new AppError("Hackathon not found", 404);

  if (viewer?.role === Role.STUDENT) {
    return {
      ...hackathon,
      eligibility: await computeHackathonEligibility(hackathon.id, viewer.id),
    };
  }

  return hackathon;
}

export async function createHackathon(actor: JWTPayload, data: {
  title: string;
  description: string;
  departmentId?: string | null;
  minSkills: string[];
  minProjects: number;
  minLeetcode: number;
  minCgpa?: number | null;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  maxTeamSize: number;
  minTeamSize: number;
  prizeDetails?: string | null;
  participantIds?: string[];
  status: "DRAFT" | "UPCOMING" | "REGISTRATION_OPEN" | "ONGOING" | "COMPLETED" | "CANCELLED";
}) {
  const participantIds = [...new Set(data.participantIds ?? [])];
  if (actor.role === Role.DEPARTMENT_HEAD) {
    if (data.departmentId && !actor.scope.departmentIds.includes(data.departmentId)) {
      throw new AppError("Forbidden", 403);
    }
  }

  if (actor.role === Role.CLASS_COORDINATOR || actor.role === Role.TEACHER) {
    if (participantIds.length === 0) {
      throw new AppError("Teachers and class coordinators must target students within their accessible sections", 400);
    }
  }

  if (participantIds.length > 0) {
    const validStudents = await prisma.user.findMany({
      where: {
        id: { in: participantIds },
        role: Role.STUDENT,
        enrollments: {
          some: {
            ...(data.departmentId ? { section: { departmentId: data.departmentId } } : {}),
            ...(actor.role === Role.CLASS_COORDINATOR || actor.role === Role.TEACHER
              ? { sectionId: { in: actor.scope.sectionIds } }
              : {}),
          },
        },
      },
      select: { id: true },
    });

    if (validStudents.length !== participantIds.length) {
      throw new AppError("Some selected students are outside the hackathon scope", 400);
    }
  }

  const hackathon = await prisma.hackathon.create({
    data: {
      title: data.title,
      description: data.description,
      departmentId: data.departmentId ?? null,
      createdById: actor.id,
      minSkills: data.minSkills,
      minProjects: data.minProjects,
      minLeetcode: data.minLeetcode,
      minCgpa: data.minCgpa ?? null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      registrationDeadline: new Date(data.registrationDeadline),
      maxTeamSize: data.maxTeamSize,
      minTeamSize: data.minTeamSize,
      prizeDetails: data.prizeDetails ?? null,
      status: data.status,
      audience: participantIds.length
        ? {
            createMany: {
              data: participantIds.map((studentId) => ({ studentId })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
    include: { department: true },
  });

  if (hackathon.status !== "DRAFT") {
    await notifyEligibleStudents(
      actor,
      hackathon.id,
      "New Hackathon",
      `${hackathon.title} is now open for registrations.`
    );
  }

  return hackathon;
}

export async function updateHackathon(id: string, data: Record<string, unknown>) {
  return prisma.hackathon.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title as string } : {}),
      ...(data.description !== undefined ? { description: data.description as string } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId as string | null } : {}),
      ...(data.minSkills !== undefined ? { minSkills: data.minSkills as string[] } : {}),
      ...(data.minProjects !== undefined ? { minProjects: data.minProjects as number } : {}),
      ...(data.minLeetcode !== undefined ? { minLeetcode: data.minLeetcode as number } : {}),
      ...(data.minCgpa !== undefined ? { minCgpa: data.minCgpa as number | null } : {}),
      ...(data.startDate !== undefined ? { startDate: new Date(data.startDate as string) } : {}),
      ...(data.endDate !== undefined ? { endDate: new Date(data.endDate as string) } : {}),
      ...(data.registrationDeadline !== undefined ? { registrationDeadline: new Date(data.registrationDeadline as string) } : {}),
      ...(data.maxTeamSize !== undefined ? { maxTeamSize: data.maxTeamSize as number } : {}),
      ...(data.minTeamSize !== undefined ? { minTeamSize: data.minTeamSize as number } : {}),
      ...(data.prizeDetails !== undefined ? { prizeDetails: data.prizeDetails as string | null } : {}),
      ...(data.status !== undefined ? { status: data.status as never } : {}),
    },
  });
}

export async function deleteHackathon(id: string) {
  await prisma.hackathon.delete({ where: { id } });
  return { success: true };
}

export async function registerForHackathon(hackathonId: string, userId: string, teamId?: string | null) {
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId } });
  if (!hackathon) throw new AppError("Hackathon not found", 404);
  if (hackathon.registrationDeadline < new Date()) {
    throw new AppError("Hackathon registration deadline has passed", 400);
  }

  const eligibility = await computeHackathonEligibility(hackathonId, userId);
  if (!eligibility.isEligible) {
    throw new AppError(eligibility.reason, 403);
  }

  const registration = await prisma.hackathonRegistration.upsert({
    where: { hackathonId_studentId: { hackathonId, studentId: userId } },
    update: {
      teamId: teamId ?? null,
      isEligible: eligibility.isEligible,
      eligibilityNote: eligibility.reason,
    },
    create: {
      hackathonId,
      studentId: userId,
      teamId: teamId ?? null,
      isEligible: eligibility.isEligible,
      eligibilityNote: eligibility.reason,
    },
  });

  return {
    ...registration,
    eligibility,
  };
}

export async function getHackathonRegistrations(hackathonId: string) {
  return prisma.hackathonRegistration.findMany({
    where: { hackathonId },
    include: {
      student: { select: { id: true, name: true, avatar: true, role: true, email: true } },
      team: { select: { id: true, name: true, teamCode: true, rank: true } },
    },
    orderBy: { registeredAt: "asc" },
  });
}

export async function createHackathonTeam(hackathonId: string, leaderId: string, payload: { name: string; memberUserIds: string[] }) {
  const allMemberIds = [...new Set([leaderId, ...payload.memberUserIds])];
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId } });
  if (!hackathon) throw new AppError("Hackathon not found", 404);

  if (allMemberIds.length < hackathon.minTeamSize || allMemberIds.length > hackathon.maxTeamSize) {
    throw new AppError("Team size is outside the allowed range", 400);
  }

  const team = await prisma.hackathonTeam.create({
    data: {
      name: payload.name,
      teamCode: generateTeamCode(),
      hackathonId,
      leaderId,
    },
  });

  for (const memberId of allMemberIds) {
    const eligibility = await computeHackathonEligibility(hackathonId, memberId);
    if (!eligibility.isEligible) {
      throw new AppError(`Team member is not eligible: ${eligibility.reason}`, 403);
    }
    await prisma.hackathonRegistration.upsert({
      where: { hackathonId_studentId: { hackathonId, studentId: memberId } },
      update: {
        teamId: team.id,
        isEligible: eligibility.isEligible,
        eligibilityNote: eligibility.reason,
      },
      create: {
        hackathonId,
        studentId: memberId,
        teamId: team.id,
        isEligible: eligibility.isEligible,
        eligibilityNote: eligibility.reason,
      },
    });
  }

  return prisma.hackathonTeam.findUnique({
    where: { id: team.id },
    include: {
      leader: { select: { id: true, name: true, avatar: true, role: true, email: true } },
      members: {
        include: {
          student: { select: { id: true, name: true, avatar: true, role: true, email: true } },
        },
      },
    },
  });
}

export async function updateHackathonTeam(hackathonId: string, teamId: string, payload: { name?: string; submissionUrl?: string | null; memberUserIds?: string[] }) {
  const team = await prisma.hackathonTeam.findFirst({
    where: { id: teamId, hackathonId },
    include: { members: true },
  });

  if (!team) throw new AppError("Team not found", 404);

  if (payload.memberUserIds) {
    const memberIds = [...new Set([team.leaderId, ...payload.memberUserIds])];
    await prisma.hackathonRegistration.updateMany({
      where: { teamId: team.id },
      data: { teamId: null },
    });

    for (const memberId of memberIds) {
      const eligibility = await computeHackathonEligibility(hackathonId, memberId);
      if (!eligibility.isEligible) {
        throw new AppError(`Team member is not eligible: ${eligibility.reason}`, 403);
      }
      await prisma.hackathonRegistration.upsert({
        where: { hackathonId_studentId: { hackathonId, studentId: memberId } },
        update: {
          teamId: team.id,
          isEligible: eligibility.isEligible,
          eligibilityNote: eligibility.reason,
        },
        create: {
          hackathonId,
          studentId: memberId,
          teamId: team.id,
          isEligible: eligibility.isEligible,
          eligibilityNote: eligibility.reason,
        },
      });
    }
  }

  return prisma.hackathonTeam.update({
    where: { id: team.id },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.submissionUrl !== undefined ? { submissionUrl: payload.submissionUrl } : {}),
    },
    include: {
      leader: { select: { id: true, name: true, avatar: true, role: true, email: true } },
      members: {
        include: {
          student: { select: { id: true, name: true, avatar: true, role: true, email: true } },
        },
      },
    },
  });
}

export async function notifyEligibleStudents(actor: JWTPayload, hackathonId: string, title: string, message: string) {
  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId } });
  if (!hackathon) throw new AppError("Hackathon not found", 404);

  const students = await prisma.user.findMany({
    where: { role: Role.STUDENT },
    select: { id: true },
  });

  const eligibleIds: string[] = [];
  for (const student of students) {
    const eligibility = await computeHackathonEligibility(hackathonId, student.id);
    if (eligibility.isEligible) eligibleIds.push(student.id);
  }

  if (eligibleIds.length === 0) {
    return [];
  }

  const notifications = await prisma.$transaction(
    eligibleIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type: "HACKATHON_CREATED",
          title,
          message,
          entityId: hackathon.id,
          entityType: "HACKATHON",
          targetDepartmentId: hackathon.departmentId ?? null,
          link: `/hackathons/${hackathon.id}`,
        },
      })
    )
  );

  notifications.forEach((notification) => {
    emitNotificationToUser(notification.userId, toNotificationDto(notification));
  });

  return notifications;
}
