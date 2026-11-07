import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPaperOrder } from "@/lib/notify";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  matchPendingOrders,
  placePaperOrder,
  serializePaperOrder,
} from "@/lib/paper-order-engine";

export const dynamic = "force-dynamic";

/**
 * What to tell the trader when an order does not go through.
 *
 * Most failures here are worth repeating word for word — insufficient balance,
 * a price that could not be fetched, a quantity that makes no sense. The
 * database's are not: a column that would not take an NSE option identifier
 * reached the order ticket as "Invalid `prisma.paperOrder.create()` invocation:
 * The provided value for the column is too long for the column's type. Column:
 * (not available)", which tells the person nothing they can act on and tells
 * whoever has to fix it nothing either, because it was never logged.
 */
function orderFailureMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : "Order failed";
  const code = (e as { code?: unknown })?.code;
  const fromDatabase =
    (typeof code === "string" && /^P\d/.test(code)) || message.includes("prisma.");

  if (fromDatabase) {
    console.error("[paper-order] database rejected the order:", message);
    return "Could not place this order right now. Please try again.";
  }
  return message;
}

/** GET — order book. POST — place order. PATCH — match pending with live quotes. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const status = new URL(req.url).searchParams.get("status");
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit") || 100)));

  const orders = await prisma.paperOrder.findMany({
    where: {
      userId: auth.userId,
      ...(status ? { status: status as "PENDING" | "EXECUTED" | "CANCELLED" | "REJECTED" | "OPEN" } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return ok({ orders: orders.map(serializePaperOrder) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{
    symbol?: string;
    side?: "buy" | "sell";
    orderType?: "MARKET" | "LIMIT" | "SL" | "SL-M";
    quantity?: number;
    limitPrice?: number;
    triggerPrice?: number;
    price?: number;
    product?: string;
    token?: string;
    exchange?: string;
    tradingSymbol?: string;
  }>(req);

  if (!body.symbol || !body.side || !body.orderType || !body.quantity) {
    return err("symbol, side, orderType, quantity are required");
  }

  const orderType = body.orderType;
  const limitPrice =
    orderType === "LIMIT" ? Number(body.limitPrice ?? body.price) : body.limitPrice;
  const triggerPrice =
    orderType === "SL" || orderType === "SL-M"
      ? Number(body.triggerPrice ?? body.price)
      : body.triggerPrice;

  if (orderType === "LIMIT" && (!limitPrice || !Number.isFinite(limitPrice))) {
    return err("limitPrice required for LIMIT orders");
  }
  if ((orderType === "SL" || orderType === "SL-M") && (!triggerPrice || !Number.isFinite(triggerPrice))) {
    return err("triggerPrice required for Stop Loss orders");
  }

  try {
    const result = await placePaperOrder({
      userId: auth.userId,
      symbol: body.symbol,
      side: body.side,
      orderType,
      quantity: Number(body.quantity),
      limitPrice: orderType === "LIMIT" ? limitPrice : orderType === "SL" ? limitPrice : undefined,
      triggerPrice,
      product: body.product,
      token: body.token,
      exchange: body.exchange,
      tradingSymbol: body.tradingSymbol,
    });

    const wallet = await prisma.virtualWallet.findUnique({ where: { userId: auth.userId } });

    await notifyPaperOrder({
      userId: auth.userId,
      symbol: body.symbol,
      side: body.side,
      quantity: Number(body.quantity),
      filled: Boolean(result.executed),
      price: result.executionPrice ?? null,
      reason: result.executed ? null : result.message,
    });

    return ok({
      order: serializePaperOrder(result.order),
      executed: result.executed,
      execution_price: result.executionPrice ?? null,
      message: result.message,
      new_balance: wallet ? Number(wallet.balance) : null,
    });
  } catch (e) {
    const reason = orderFailureMessage(e);
    // A rejected order is exactly the case the user needs telling about — this
    // is how every paper order silently failed before.
    await notifyPaperOrder({
      userId: auth.userId,
      symbol: String(body.symbol),
      side: String(body.side),
      quantity: Number(body.quantity),
      filled: false,
      reason,
    });
    return err(reason, 400);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{ quotes?: { symbol: string; ltp: number }[] }>(req);
  const quotes = body.quotes ?? [];
  if (!quotes.length) return err("quotes array required");

  const result = await matchPendingOrders(auth.userId, quotes);
  return ok(result);
}
