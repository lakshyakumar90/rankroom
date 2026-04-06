import { prisma } from "@repo/database";
import { RegistrationStatus } from "@repo/database";
import { AppError } from "../middleware/error";
import type { JWTPayload } from "@repo/types";
import { Role } from "@repo/types";

// ─── Registration projection ──────────────────────────────────────────────────

export type RegistrationState =
  | { status: "NOT_REGISTERED"; canRegister: boolean; reason?: string }
  | { status: "REGISTERED"; teamId?: string | null }
  | { status: "PENDING"; teamId?: string | null }
  | { status: "WITHDRAWN" }
  | { status: "WAITLISTED" }
  | { status: "REJECTED"; reason?: string | null };

export type TeamState =
  | { status: "NO_TEAM"; canCreate: boolean; canJoin: boolean }
  | { status: "LEADER"; teamId: string; teamName: string; memberCount: number; isLocked: boolean }
  | { status: "MEMBER"; teamId: string; teamName: string; isLocked: boolean }
  | { status: "JOIN_REQUEST_PENDING"; teamId: string; requestId: string }
  | { status: "INVITE_PENDING"; teamId: string; inviteId: string };

// ─── Contest registration state ───────────────────────────────────────────────

export async function getContestRegistrationState(
  contestId: string,
  userId: string
): Promise<RegistrationState> {
  const registration = await prisma.contestRegistration.findFirst({
    where: { contestId, userId },
    select: { status: true, registeredAt: true },
  });

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { status: true, startTime: true, endTime: true, registrationEnd: true, maxParticipants: true },
  });

  if (!contest) throw new AppError("Contest not found", 404);

  if (!registration) {
    const now = new Date();
    const registrationClosed = contest.registrationEnd
      ? now > contest.registrationEnd
      : now > contest.endTime;
    const contestEnded = now > contest.endTime;

    if (contestEnded) {
      return { status: "NOT_REGISTERED", canRegister: false, reason: "Contest has ended" };
    }
    if (registrationClosed) {
      return { status: "NOT_REGISTERED", canRegister: false, reason: "Registration closed" };
    }
    if (contest.maxParticipants) {
      const count = await prisma.contestRegistration.count({
        where: { contestId, status: { not: RegistrationStatus.WITHDRAWN } },
      });
      if (count >= contest.maxParticipants) {
        return { status: "WAITLISTED", };
      }
    }
    return { status: "NOT_REGISTERED", canRegister: true };
  }

  if (registration.status === RegistrationStatus.REGISTERED) return { status: "REGISTERED" };
  if (registration.status === RegistrationStatus.PENDING) return { status: "PENDING" };
  if (registration.status === RegistrationStatus.WITHDRAWN) return { status: "WITHDRAWN" };
  if (registration.status === RegistrationStatus.WAITLISTED) return { status: "WAITLISTED" };
  if (registration.status === RegistrationStatus.REJECTED) return { status: "REJECTED" };
  return { status: "REGISTERED" };
}

// ─── Hackathon registration state ────────────────────────────────────────────

export async function getHackathonRegistrationState(
  hackathonId: string,
  userId: string
): Promise<RegistrationState> {
  const registration = await prisma.hackathonRegistration.findFirst({
    where: { hackathonId, studentId: userId },
    select: { isEligible: true, registeredAt: true },
  });

  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { status: true, registrationDeadline: true, startDate: true, endDate: true },
  });

  if (!hackathon) throw new AppError("Hackathon not found", 404);

  if (!registration) {
    const now = new Date();
    const deadlinePassed = now > hackathon.registrationDeadline;
    const hackathonEnded = now > hackathon.endDate;
    if (hackathonEnded) return { status: "NOT_REGISTERED", canRegister: false, reason: "Hackathon has ended" };
    if (deadlinePassed) return { status: "NOT_REGISTERED", canRegister: false, reason: "Registration deadline passed" };
    return { status: "NOT_REGISTERED", canRegister: true };
  }

  return { status: "REGISTERED" };
}

// ─── Team state for an event ─────────────────────────────────────────────────

export async function getEventTeamState(
  eventId: string,
  eventType: "hackathon" | "contest",
  userId: string
): Promise<TeamState> {
  // Check if member of a team
  const membership = await prisma.eventTeamMember.findFirst({
    where: {
      userId,
      team: eventType === "hackathon" ? { hackathonId: eventId } : { contestId: eventId },
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          leaderId: true,
          isLocked: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (membership) {
    const { team } = membership;
    if (team.leaderId === userId) {
      return {
        status: "LEADER",
        teamId: team.id,
        teamName: team.name,
        memberCount: team._count.members,
        isLocked: team.isLocked,
      };
    }
    return { status: "MEMBER", teamId: team.id, teamName: team.name, isLocked: team.isLocked };
  }

  // Check pending join requests
  const joinRequest = await prisma.eventTeamJoinRequest.findFirst({
    where: {
      userId,
      status: "PENDING",
      team: eventType === "hackathon" ? { hackathonId: eventId } : { contestId: eventId },
    },
    select: { id: true, teamId: true },
  });

  if (joinRequest) {
    return { status: "JOIN_REQUEST_PENDING", teamId: joinRequest.teamId, requestId: joinRequest.id };
  }

  // Check pending invites
  const invite = await prisma.eventTeamInvite.findFirst({
    where: {
      invitedId: userId,
      status: "PENDING",
      team: eventType === "hackathon" ? { hackathonId: eventId } : { contestId: eventId },
    },
    select: { id: true, teamId: true },
  });

  if (invite) {
    return { status: "INVITE_PENDING", teamId: invite.teamId, inviteId: invite.id };
  }

  const hackathon = eventType === "hackathon"
    ? await prisma.hackathon.findUnique({ where: { id: eventId }, select: { minTeamSize: true, maxTeamSize: true } })
    : null;

  return {
    status: "NO_TEAM",
    canCreate: true,
    canJoin: hackathon ? hackathon.maxTeamSize > 1 : true,
  };
}

// ─── Build viewer-aware contest payload ──────────────────────────────────────

export async function buildContestViewerPayload(contestId: string, viewer: JWTPayload) {
  const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER].includes(viewer.role);

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      problems: {
        include: { problem: { select: { id: true, title: true, difficulty: true, points: true } } },
        orderBy: { order: "asc" },
      },
      standings: isStaff
        ? {
            include: { user: { select: { id: true, name: true, avatar: true } } },
            orderBy: { rank: "asc" },
            take: 50,
          }
        : false,
      registrations: isStaff
        ? {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            take: 200,
          }
        : false,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { problems: true, registrations: true } },
    },
  });

  if (!contest) throw new AppError("Contest not found", 404);

  const registrationState = await getContestRegistrationState(contestId, viewer.id);

  // For students: only expose their own standings row
  const ownStandingRow = !isStaff
    ? await prisma.contestStanding.findFirst({
        where: { contestId, userId: viewer.id },
        select: {
          totalScore: true,
          rank: true,
          solvedCount: true,
          penalty: true,
          acceptedCount: true,
          wrongCount: true,
        },
      })
    : null;

  const isRegistered = registrationState.status === "REGISTERED" || registrationState.status === "PENDING";

  return {
    ...contest,
    // Strip participant list for non-staff
    registrations: isStaff ? contest.registrations : undefined,
    standings: isStaff ? contest.standings : undefined,
    // Convenience booleans for frontend
    isRegistered,
    // Viewer state
    viewerState: {
      registrationState,
      ownStanding: ownStandingRow,
      isStaff,
    },
  };
}

// ─── Build viewer-aware hackathon payload ─────────────────────────────────────

export async function buildHackathonViewerPayload(hackathonId: string, viewer: JWTPayload) {
  const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER].includes(viewer.role);

  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    include: {
      registrations: {
        include: {
          student: { select: { id: true, name: true, email: true, avatar: true } },
        },
      },
      teams: {
        include: {
          leader: { select: { id: true, name: true } },
          members: { include: { student: { select: { id: true, name: true, avatar: true } } } },
        },
      },
      createdBy: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  if (!hackathon) throw new AppError("Hackathon not found", 404);

  const registrationState = await getHackathonRegistrationState(hackathonId, viewer.id);

  return {
    ...hackathon,
    registrations: isStaff ? hackathon.registrations : undefined,
    teams: isStaff ? hackathon.teams : undefined,
    viewerState: {
      registrationState,
      teamState: { status: "NO_TEAM", canCreate: false, canJoin: false },
      ownTeam: null,
      isStaff,
    },
  };
}

// ─── Register for contest ─────────────────────────────────────────────────────

export async function registerForContest(contestId: string, userId: string) {
  const state = await getContestRegistrationState(contestId, userId);
  if (state.status !== "NOT_REGISTERED") {
    throw new AppError("Already registered or registration not possible", 400);
  }
  if (!state.canRegister) {
    throw new AppError(state.reason ?? "Registration not allowed", 400);
  }

  return prisma.contestRegistration.upsert({
    where: { contestId_userId: { contestId, userId } },
    update: { status: RegistrationStatus.REGISTERED },
    create: { contestId, userId, status: RegistrationStatus.REGISTERED },
  });
}
