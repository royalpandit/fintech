import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      occurredAt: { gte: monthStart, lte: monthEnd },
    },
    include: { category: true },
  });

  const totalSpent = transactions
    .filter((t) => t.txnType === "debit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalIncome = transactions
    .filter((t) => t.txnType === "credit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const recommendations: string[] = [];
  if (totalSpent > totalIncome * 0.9) {
    recommendations.push("Spending is close to income. Consider reducing non-essential expenses.");
  }

  return ok({
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    total_spent: totalSpent,
    total_income: totalIncome,
    transaction_count: transactions.length,
    recommendations,
  });
}
