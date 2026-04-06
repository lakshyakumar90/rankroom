import { prisma } from "@repo/database";
import { recomputeSectionLeaderboard } from "./leaderboard.service";

/**
 * Approve a certificate (called by CC / admin).
 * Awards the xpBonus to the student's leaderboard and triggers a recompute.
 */
export async function approveCertificate(
  certificateId: string,
  approverId: string
): Promise<void> {
  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    select: { studentId: true, xpBonus: true, status: true },
  });

  if (!cert) throw new Error("Certificate not found");
  if (cert.status !== "PENDING") throw new Error("Certificate is not pending approval");

  await prisma.certificate.update({
    where: { id: certificateId },
    data: { status: "APPROVED", approvedById: approverId, approvedAt: new Date() },
  });

  if (cert.xpBonus > 0) {
    await prisma.leaderboard.upsert({
      where: { userId: cert.studentId },
      update: { totalPoints: { increment: cert.xpBonus } },
      create: { userId: cert.studentId, totalPoints: cert.xpBonus, problemsSolved: 0 },
    });

    await prisma.profile.upsert({
      where: { userId: cert.studentId },
      update: { totalPoints: { increment: cert.xpBonus } },
      create: { userId: cert.studentId, skills: [], totalPoints: cert.xpBonus },
    });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: cert.studentId },
    select: { sectionId: true },
  });

  await Promise.all(
    [...new Set(enrollments.map((e) => e.sectionId))].map((sectionId) =>
      recomputeSectionLeaderboard(sectionId)
    )
  );

  await prisma.notification.create({
    data: {
      userId: cert.studentId,
      type: "CERTIFICATE_APPROVED",
      title: "Certificate Approved",
      message: "Your certificate has been verified and XP has been awarded.",
      link: "/profile/edit",
      entityId: certificateId,
      entityType: "CERTIFICATE",
    },
  });
}

/**
 * Reject a certificate (called by CC / admin).
 */
export async function rejectCertificate(
  certificateId: string,
  approverId: string,
  reason: string
): Promise<void> {
  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    select: { studentId: true, status: true },
  });

  if (!cert) throw new Error("Certificate not found");
  if (cert.status !== "PENDING") throw new Error("Certificate is not pending");

  await prisma.certificate.update({
    where: { id: certificateId },
    data: {
      status: "REJECTED",
      approvedById: approverId,
      approvedAt: new Date(),
      rejectionReason: reason,
    },
  });

  await prisma.notification.create({
    data: {
      userId: cert.studentId,
      type: "CERTIFICATE_REJECTED",
      title: "Certificate Not Approved",
      message: `Your certificate submission was not approved. Reason: ${reason}`,
      link: "/profile/edit",
      entityId: certificateId,
      entityType: "CERTIFICATE",
    },
  });
}

/**
 * Submit an external certificate for CC review.
 */
export async function submitExternalCertificate(
  studentId: string,
  data: {
    title: string;
    description?: string;
    externalUrl?: string;
    proofFile?: string;
    xpBonus?: number;
  }
) {
  const verificationCode = `CERT-EXT-${studentId.slice(-6)}-${Date.now().toString(36).toUpperCase()}`;

  return prisma.certificate.create({
    data: {
      studentId,
      type: "EXTERNAL",
      title: data.title,
      description: data.description,
      externalUrl: data.externalUrl,
      proofFile: data.proofFile,
      xpBonus: data.xpBonus ?? 50,
      status: "PENDING",
      verificationCode,
    },
  });
}

/**
 * Auto-award a streak certificate after solving N problems in a row.
 */
export async function checkAndAwardStreakCertificate(
  studentId: string,
  streak: number
): Promise<void> {
  const milestones: Record<number, { xp: number; label: string }> = {
    50: { xp: 75, label: "50-Problem Solving Streak" },
    100: { xp: 200, label: "100-Problem Solving Streak" },
    200: { xp: 400, label: "200-Problem Solving Streak" },
  };

  const milestone = milestones[streak];
  if (!milestone) return;

  const existing = await prisma.certificate.findFirst({
    where: { studentId, title: { contains: milestone.label } },
  });
  if (existing) return;

  await prisma.certificate.create({
    data: {
      studentId,
      type: "PROBLEM_STREAK",
      title: milestone.label,
      description: `Solved ${streak} problems consistently on RankRoom.`,
      xpBonus: milestone.xp,
      status: "APPROVED",
      verificationCode: `CERT-STREAK-${streak}-${studentId.slice(-8).toUpperCase()}`,
    },
  });

  await prisma.leaderboard.upsert({
    where: { userId: studentId },
    update: { totalPoints: { increment: milestone.xp } },
    create: { userId: studentId, totalPoints: milestone.xp, problemsSolved: 0 },
  });

  await prisma.notification.create({
    data: {
      userId: studentId,
      type: "CERTIFICATE_EARNED",
      title: "Achievement Unlocked!",
      message: `You earned the "${milestone.label}" certificate and ${milestone.xp} XP.`,
      link: "/profile/edit",
    },
  });
}
