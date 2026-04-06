import { prisma } from "@repo/database";
import { TeamRequestStatus } from "@repo/database";
import { AppError } from "../middleware/error";
import { nanoid } from "nanoid";

// ─── Create a team ────────────────────────────────────────────────────────────

export async function createEventTeam({
  hackathonId,
  contestId,
  name,
  leaderId,
}: {
  hackathonId?: string;
  contestId?: string;
  name: string;
  leaderId: string;
}) {
  if (!hackathonId && !contestId) throw new AppError("Must specify hackathon or contest", 400);

  // Enforce one team per event per student
  const existing = await prisma.eventTeamMember.findFirst({
    where: {
      userId: leaderId,
      team: hackathonId ? { hackathonId } : { contestId },
    },
  });
  if (existing) throw new AppError("You are already in a team for this event", 400);

  const teamCode = nanoid(8).toUpperCase();

  const team = await prisma.eventTeam.create({
    data: {
      hackathonId,
      contestId,
      name,
      teamCode,
      leaderId,
      members: {
        create: { userId: leaderId, isLeader: true },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
    },
  });

  return team;
}

// ─── Submit join request ──────────────────────────────────────────────────────

export async function requestToJoinTeam(teamId: string, userId: string, message?: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { members: true, _count: { select: { members: true } } },
  });
  if (!team) throw new AppError("Team not found", 404);
  if (team.isLocked) throw new AppError("Team is locked", 400);

  // Ensure already not in a team for this event
  const eventFilter = team.hackathonId ? { hackathonId: team.hackathonId } : { contestId: team.contestId };
  const existing = await prisma.eventTeamMember.findFirst({
    where: { userId, team: eventFilter },
  });
  if (existing) throw new AppError("You are already in a team for this event", 400);

  // Prevent duplicate pending request
  const existingReq = await prisma.eventTeamJoinRequest.findFirst({
    where: { teamId, userId, status: TeamRequestStatus.PENDING },
  });
  if (existingReq) throw new AppError("You already have a pending request for this team", 400);

  return prisma.eventTeamJoinRequest.create({
    data: { teamId, userId, message, status: TeamRequestStatus.PENDING },
  });
}

// ─── Approve join request ─────────────────────────────────────────────────────

export async function approveJoinRequest(requestId: string, approverId: string) {
  const request = await prisma.eventTeamJoinRequest.findUnique({
    where: { id: requestId },
    include: { team: { include: { _count: { select: { members: true } } } } },
  });
  if (!request) throw new AppError("Request not found", 404);
  if (request.team.leaderId !== approverId) throw new AppError("Only team leader can approve requests", 403);
  if (request.status !== TeamRequestStatus.PENDING) throw new AppError("Request is not pending", 400);
  if (request.team.isLocked) throw new AppError("Team is locked", 400);

  // Get hackathon max team size
  let maxSize = 99;
  if (request.team.hackathonId) {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: request.team.hackathonId },
      select: { maxTeamSize: true },
    });
    maxSize = hackathon?.maxTeamSize ?? 99;
  }
  if (request.team._count.members >= maxSize) {
    throw new AppError("Team is full", 400);
  }

  await prisma.$transaction([
    prisma.eventTeamJoinRequest.update({
      where: { id: requestId },
      data: { status: TeamRequestStatus.APPROVED, respondedAt: new Date(), respondedBy: approverId },
    }),
    prisma.eventTeamMember.create({
      data: { teamId: request.teamId, userId: request.userId },
    }),
  ]);

  return { success: true };
}

// ─── Reject join request ──────────────────────────────────────────────────────

export async function rejectJoinRequest(requestId: string, rejecterId: string) {
  const request = await prisma.eventTeamJoinRequest.findUnique({
    where: { id: requestId },
    include: { team: true },
  });
  if (!request) throw new AppError("Request not found", 404);
  if (request.team.leaderId !== rejecterId) throw new AppError("Only team leader can reject requests", 403);

  return prisma.eventTeamJoinRequest.update({
    where: { id: requestId },
    data: { status: TeamRequestStatus.REJECTED, respondedAt: new Date(), respondedBy: rejecterId },
  });
}

// ─── Accept invite ────────────────────────────────────────────────────────────

export async function acceptTeamInvite(inviteId: string, userId: string) {
  const invite = await prisma.eventTeamInvite.findUnique({
    where: { id: inviteId },
    include: { team: { include: { _count: { select: { members: true } } } } },
  });
  if (!invite) throw new AppError("Invite not found", 404);
  if (invite.invitedId !== userId) throw new AppError("This invite is not for you", 403);
  if (invite.status !== TeamRequestStatus.PENDING) throw new AppError("Invite is no longer pending", 400);
  if (invite.team.isLocked) throw new AppError("Team is locked", 400);

  await prisma.$transaction([
    prisma.eventTeamInvite.update({
      where: { id: inviteId },
      data: { status: TeamRequestStatus.APPROVED, respondedAt: new Date() },
    }),
    prisma.eventTeamMember.create({
      data: { teamId: invite.teamId, userId },
    }),
  ]);

  return { success: true };
}

// ─── Send invite ──────────────────────────────────────────────────────────────

export async function sendTeamInvite(teamId: string, invitedId: string, invitedById: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { _count: { select: { members: true } } },
  });
  if (!team) throw new AppError("Team not found", 404);
  if (team.leaderId !== invitedById) throw new AppError("Only team leader can send invites", 403);
  if (team.isLocked) throw new AppError("Team is locked", 400);

  const existing = await prisma.eventTeamInvite.findFirst({
    where: { teamId, invitedId, status: TeamRequestStatus.PENDING },
  });
  if (existing) throw new AppError("An invite is already pending for this user", 400);

  return prisma.eventTeamInvite.create({
    data: { teamId, invitedId, invitedById, status: TeamRequestStatus.PENDING },
  });
}

// ─── Transfer leadership ──────────────────────────────────────────────────────

export async function transferTeamLeadership(teamId: string, currentLeaderId: string, newLeaderId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    include: { members: { where: { userId: newLeaderId } } },
  });
  if (!team) throw new AppError("Team not found", 404);
  if (team.leaderId !== currentLeaderId) throw new AppError("Only the current leader can transfer leadership", 403);
  if (team.isLocked) throw new AppError("Team is locked", 400);
  if (!team.members.length) throw new AppError("Target user is not in the team", 400);

  await prisma.$transaction([
    prisma.eventTeam.update({ where: { id: teamId }, data: { leaderId: newLeaderId } }),
    prisma.eventTeamMember.updateMany({ where: { teamId, userId: currentLeaderId }, data: { isLeader: false } }),
    prisma.eventTeamMember.updateMany({ where: { teamId, userId: newLeaderId }, data: { isLeader: true } }),
  ]);

  return { success: true };
}

// ─── List open teams for an event (for joining) ───────────────────────────────

export async function listOpenTeams(hackathonId?: string, contestId?: string, maxSize?: number) {
  const hackathon = hackathonId
    ? await prisma.hackathon.findUnique({ where: { id: hackathonId }, select: { maxTeamSize: true } })
    : null;

  const effectiveMax = maxSize ?? hackathon?.maxTeamSize ?? 99;

  return prisma.eventTeam.findMany({
    where: {
      ...(hackathonId ? { hackathonId } : {}),
      ...(contestId ? { contestId } : {}),
      isLocked: false,
    },
    include: {
      leader: { select: { id: true, name: true, avatar: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      _count: { select: { members: true } },
    },
  }).then((teams) => teams.filter((t) => t._count.members < effectiveMax));
}
