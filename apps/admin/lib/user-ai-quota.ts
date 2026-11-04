import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFinuerProStatus } from "@/lib/finuer-pro";

export const FREE_AI_QUERY_LIMIT = 3;
export const PRO_AI_MONTHLY_QUERY_LIMIT = 50;

export async function reserveUserAiQuery(userId: number, role: UserRole, feature: string) {
  const isPro = (await getFinuerProStatus(userId, role)).active;
  const limit = isPro ? PRO_AI_MONTHLY_QUERY_LIMIT : FREE_AI_QUERY_LIMIT;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const used = await tx.aiLog.count({
      where: {
        userId,
        module: "user_ai_query",
        ...(isPro ? { createdAt: { gte: monthStart } } : {}),
      },
    });

    if (used >= limit) return { allowed: false, used, limit, isPro };

    await tx.aiLog.create({
      data: {
        userId,
        module: "user_ai_query",
        inputData: { feature },
      },
    });

    return { allowed: true, used: used + 1, limit, isPro };
  });
}
