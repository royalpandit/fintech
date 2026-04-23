import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "active";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Number(searchParams.get("limit")) || 50);

  const where: Record<string, unknown> = { advisorUserId: auth.userId };
  if (["active", "expired", "cancelled", "pending", "past_due"].includes(status)) {
    where.status = status;
  }

  const [rows, total, totals] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.subscription.count({ where }),
    prisma.subscription.groupBy({
      by: ["status"],
      where: { advisorUserId: auth.userId },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  return ok({
    data: rows,
    total,
    page,
    limit,
    summary: totals.reduce<Record<string, { count: number; revenue: number }>>((acc, row) => {
      acc[row.status] = {
        count: row._count._all,
        revenue: Number(row._sum.amount ?? 0),
      };
      return acc;
    }, {}),
  });
}
