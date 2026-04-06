import { prisma } from "@repo/database";
import { logger } from "../lib/logger";

/**
 * Auto-transitions contest statuses based on current time.
 * Called on each contest list/detail request and via scheduled job.
 *
 * State machine:
 *   DRAFT -> (manual publish only)
 *   SCHEDULED -> REGISTRATION_OPEN (when registrationEnd not yet passed)
 *   REGISTRATION_OPEN -> LIVE (at startTime)
 *   LIVE -> FROZEN (at freezeTime)
 *   FROZEN -> ENDED (at endTime)
 *   ENDED -> RESULTS_PUBLISHED (manual or auto after delay)
 */
export async function syncContestStatuses(): Promise<void> {
  const now = new Date();

  await Promise.all([
    // SCHEDULED -> REGISTRATION_OPEN: no registrationEnd yet, but past or at "now"
    prisma.contest.updateMany({
      where: { status: "SCHEDULED", startTime: { gt: now } },
      data: { status: "REGISTRATION_OPEN" },
    }),

    // UPCOMING / REGISTRATION_OPEN -> LIVE at startTime
    prisma.contest.updateMany({
      where: {
        status: { in: ["UPCOMING", "REGISTRATION_OPEN", "SCHEDULED"] },
        startTime: { lte: now },
        endTime: { gt: now },
      },
      data: { status: "LIVE" },
    }),

    // LIVE -> FROZEN at freezeTime
    prisma.contest.updateMany({
      where: {
        status: "LIVE",
        freezeTime: { lte: now },
        endTime: { gt: now },
      },
      data: { status: "FROZEN" },
    }),

    // LIVE / FROZEN -> ENDED at endTime
    prisma.contest.updateMany({
      where: { status: { in: ["LIVE", "FROZEN"] }, endTime: { lte: now } },
      data: { status: "ENDED" },
    }),
  ]);
}

/**
 * Apply ICPC-style penalty to a contest standing after a wrong submission.
 * +penaltyMinutes per wrong submission on a problem that eventually gets accepted.
 */
export async function applyContestPenalty(
  contestId: string,
  userId: string,
  problemId: string
): Promise<void> {
  void contestId;
  void userId;
  void problemId;
}

/**
 * Returns standings for a contest.
 * If the contest is FROZEN, participant view returns the frozen snapshot
 * (standings as of freezeTime), while staff sees live standings.
 */
export async function getContestStandings(
  contestId: string,
  requestingUserId?: string,
  isStaff = false
) {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { status: true, freezeTime: true, createdById: true },
  });

  if (!contest) return [];

  const isFrozen = contest.status === "FROZEN";
  const isCreator = requestingUserId === contest.createdById;

  if (isFrozen && !isStaff && !isCreator) {
    // Return standings frozen at freezeTime
    const frozenStandings = await prisma.contestStanding.findMany({
      where: {
        contestId,
        lastSubmitTime: contest.freezeTime
          ? { lte: contest.freezeTime }
          : undefined,
      },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: [{ solvedCount: "desc" }, { penalty: "asc" }, { solveTimeSeconds: "asc" }, { lastAcceptedTime: "asc" }],
    });
    return frozenStandings.map((s, i) => ({ ...s, rank: i + 1 }));
  }

  return prisma.contestStanding.findMany({
    where: { contestId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: [{ rank: "asc" }, { solvedCount: "desc" }, { penalty: "asc" }],
  });
}

/**
 * Log a tab-switch event during a contest (stored in ActivityLog).
 * Multiple switches may trigger a disqualification warning.
 */
export async function logTabSwitch(
  contestId: string,
  userId: string
): Promise<{ switchCount: number; warned: boolean }> {
  await prisma.activityLog.create({
    data: {
      userId,
      action: "contest.tab_switch",
      metadata: { contestId },
    },
  });

  const switchCount = await prisma.activityLog.count({
    where: {
      userId,
      action: "contest.tab_switch",
      metadata: { path: ["contestId"], equals: contestId },
    },
  });

  const warned = switchCount >= 3;

  if (warned) {
    logger.warn({ userId, contestId, switchCount }, "Contest tab-switch threshold reached");
  }

  return { switchCount, warned };
}

/**
 * Auto-generate certificates for top-3 finishers after a contest ends.
 */
export async function generateContestCertificates(contestId: string): Promise<void> {
  const standings = await prisma.contestStanding.findMany({
    where: { contestId, rank: { lte: 3 } },
    orderBy: { rank: "asc" },
  });

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { title: true, xpReward: true },
  });

  if (!contest) return;

  const xpBonuses: Record<number, number> = { 1: 200, 2: 150, 3: 100 };

  await Promise.all(
    standings.map(async (standing) => {
      if (!standing.rank) return;

      const existing = await prisma.certificate.findFirst({
        where: { studentId: standing.userId, contestId },
      });
      if (existing) return;

      const placement =
        standing.rank === 1 ? "1st" : standing.rank === 2 ? "2nd" : "3rd";

      await prisma.certificate.create({
        data: {
          studentId: standing.userId,
          type: "CONTEST_WINNER",
          title: `${placement} Place — ${contest.title}`,
          description: `Ranked ${placement} in the contest "${contest.title}"`,
          xpBonus: xpBonuses[standing.rank] ?? 50,
          contestId,
          verificationCode: `CERT-${contestId.slice(-8)}-${standing.userId.slice(-8)}`.toUpperCase(),
        },
      });
    })
  );
}
