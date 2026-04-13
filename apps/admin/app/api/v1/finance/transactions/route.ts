import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

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
