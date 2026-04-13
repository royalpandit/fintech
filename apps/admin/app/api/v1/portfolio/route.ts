import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const portfolios = await prisma.portfolio.findMany({
    where: { userId, deletedAt: null },
    include: {
      assets: { orderBy: { marketValue: "desc" } },
    },
  });

  const totalValue = portfolios.reduce(
    (sum, p) => sum + Number(p.totalValue),
    0,
  );

  return ok({
    total_value: totalValue,
    holdings: portfolios.flatMap((p) => p.assets),
    portfolios,
  });
}
