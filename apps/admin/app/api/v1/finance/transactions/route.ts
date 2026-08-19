import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { checkBudgetBreach } from "@/lib/budget-alerts";
import { requireAuth, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Number(searchParams.get("limit")) || 20);

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { category: { select: { name: true } } },
    }),
    prisma.transaction.count({ where: { userId } }),
  ]);

  return ok({ data, total, page, limit });
}

/**
 * Record a transaction. Nothing could create one before this — the finance
 * module was read-only, which is also why budget breach alerts never fired.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const body = await parseBody<{
    amount?: number | string;
    txnType?: string;
    category?: string;
    merchantName?: string;
    description?: string;
    occurredAt?: string;
  }>(req);

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return err("A positive amount is required");

  const txnType = body.txnType === "credit" ? "credit" : "debit";

  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) return err("occurredAt must be a valid date");

  // Categories are created on first use, matching the budget route's behaviour.
  let categoryId: number | null = null;
  const categoryName = body.category?.trim();
  if (categoryName) {
    const cat =
      (await prisma.expenseCategory.findUnique({ where: { name: categoryName } })) ??
      (await prisma.expenseCategory.create({ data: { name: categoryName, isSystem: false } }));
    categoryId = cat.id;
  }

  const txn = await prisma.transaction.create({
    data: {
      userId,
      amount,
      txnType,
      categoryId,
      merchantName: body.merchantName?.trim()?.slice(0, 150) || null,
      description: body.description?.trim() || null,
      occurredAt,
      categorizedBy: categoryName ? "user" : "ai",
    },
    include: { category: { select: { name: true } } },
  });

  // Only spending can breach a budget.
  if (txnType === "debit") {
    await checkBudgetBreach({ userId, categoryId, occurredAt, amount });
  }

  return ok({ transaction: txn });
}
