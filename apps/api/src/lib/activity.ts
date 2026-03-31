import { Prisma, prisma } from "@repo/database";

export async function logActivity(userId: string, action: string, metadata?: Record<string, unknown>) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Activity logging should not break the primary workflow.
  }
}
