import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: 100,
    include: { category: true },
  });

  const categoryTotals: Record<string, number> = {};
  transactions.forEach((t) => {
    const cat = t.category?.name || "Uncategorized";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
  });

  const suggestions: string[] = [];
  const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    suggestions.push(`Top spending: ${sorted[0][0]} at ${sorted[0][1].toFixed(2)}`);
  }
  suggestions.push("Reduce discretionary spend by 15%");

  return ok({ suggestions, anomalies: [], category_breakdown: categoryTotals });
}
