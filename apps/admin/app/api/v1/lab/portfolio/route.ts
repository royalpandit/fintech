import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const wallet = await prisma.virtualWallet.findUnique({
    where: { userId },
    include: {
      trades: { orderBy: { tradedAt: "desc" } },
    },
  });

  if (!wallet) return ok({ data: [] });

  const positions: Record<string, { symbol: string; quantity: number; avgPrice: number }> = {};
  for (const t of [...wallet.trades].reverse()) {
    const key = t.symbol;
    if (!positions[key]) positions[key] = { symbol: key, quantity: 0, avgPrice: 0 };
    const pos = positions[key];
    if (t.side === "buy") {
      const totalCost = pos.avgPrice * pos.quantity + Number(t.price) * Number(t.quantity);
      pos.quantity += Number(t.quantity);
      pos.avgPrice = pos.quantity > 0 ? totalCost / pos.quantity : 0;
    } else {
      pos.quantity -= Number(t.quantity);
    }
  }

  const data = Object.values(positions).filter((p) => p.quantity > 0);
  return ok({ data });
}
