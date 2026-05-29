import { NextRequest } from "next/server";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { placePaperOrder, serializePaperOrder } from "@/lib/paper-order-engine";

/** @deprecated Prefer POST /api/v1/lab/orders with orderType MARKET */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{
    symbol?: string;
    side?: "buy" | "sell";
    quantity?: number;
    price?: number;
    token?: string;
    exchange?: string;
    tradingSymbol?: string;
  }>(req);

  if (!body.symbol || !body.side || !body.quantity) {
    return err("symbol, side, quantity are required");
  }

  try {
    const result = await placePaperOrder({
      userId: auth.userId,
      symbol: body.symbol,
      side: body.side,
      orderType: "MARKET",
      quantity: Number(body.quantity),
      token: body.token,
      exchange: body.exchange,
      tradingSymbol: body.tradingSymbol,
    });

    return ok({
      trade: result.order.tradeId ? { id: result.order.tradeId } : null,
      order: serializePaperOrder(result.order),
      executed: result.executed,
      new_balance: null,
      message: result.message,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Trade failed", 400);
  }
}
