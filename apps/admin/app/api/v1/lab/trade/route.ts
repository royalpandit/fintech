import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const body = await parseBody<{
    symbol?: string;
    side?: "buy" | "sell";
    quantity?: number;
    price?: number;
  }>(req);

  if (!body.symbol || !body.side || !body.quantity || !body.price) {
    return err("symbol, side, quantity, price are required");
  }

  const wallet = await prisma.virtualWallet.findUnique({ where: { userId } });
  if (!wallet) return err("No virtual wallet. Create one first.", 404);

  const cost = body.quantity * body.price;

  if (body.side === "buy" && Number(wallet.balance) < cost) {
    return err("Insufficient virtual balance");
  }

  const trade = await prisma.tradeVirtual.create({
    data: {
      walletId: wallet.id,
      symbol: body.symbol.toUpperCase(),
      side: body.side,
      quantity: body.quantity,
      price: body.price,
    },
  });

  const newBalance =
    body.side === "buy"
      ? Number(wallet.balance) - cost
      : Number(wallet.balance) + cost;

  await prisma.virtualWallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance },
  });

  return ok({ trade, executed: true, new_balance: newBalance });
}
