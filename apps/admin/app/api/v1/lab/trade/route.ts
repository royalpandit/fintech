import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { getSellableQuantity, type VirtualTradeRow } from "@/lib/virtual-trading";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const body = await parseBody<{
    symbol?: string;
    side?: "buy" | "sell";
    quantity?: number;
    price?: number;
  }>(req);

  if (!body.symbol || !body.side || !body.quantity || !body.price) {
    return err("symbol, side, quantity, price are required");
  }

  const symbol = body.symbol.toUpperCase();
  const quantity = Number(body.quantity);
  const price = Number(body.price);

  if (!Number.isFinite(quantity) || quantity <= 0) return err("quantity must be positive");
  if (!Number.isFinite(price) || price <= 0) return err("price must be positive");

  const wallet = await prisma.virtualWallet.findUnique({
    where: { userId },
    include: { trades: { orderBy: { tradedAt: "asc" } } },
  });
  if (!wallet) return err("No virtual wallet. Create one first.", 404);

  const cost = quantity * price;

  if (body.side === "buy" && Number(wallet.balance) < cost) {
    return err("Insufficient virtual balance");
  }

  if (body.side === "sell") {
    const history: VirtualTradeRow[] = wallet.trades.map((t) => ({
      symbol: t.symbol,
      side: t.side as "buy" | "sell",
      quantity: Number(t.quantity),
      price: Number(t.price),
      tradedAt: t.tradedAt,
    }));
    const available = getSellableQuantity(symbol, history);
    if (quantity > available) {
      return err(`Insufficient holdings. You can sell at most ${available} units of ${symbol}`);
    }
  }

  const trade = await prisma.tradeVirtual.create({
    data: {
      walletId: wallet.id,
      symbol,
      side: body.side,
      quantity,
      price,
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
