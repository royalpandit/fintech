import type { PaperOrderStatus, PaperOrderType, TradeSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchLiveLtp, normalizePaperSymbol } from "@/lib/paper-market-quote";
import {
  getSellableQuantity,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";

export type PlacePaperOrderInput = {
  userId: number;
  symbol: string;
  side: "buy" | "sell";
  orderType: "MARKET" | "LIMIT" | "SL" | "SL-M";
  quantity: number;
  limitPrice?: number;
  triggerPrice?: number;
  product?: string;
  token?: string;
  exchange?: string;
  tradingSymbol?: string;
};

export type LiveQuote = {
  symbol: string;
  ltp: number;
};

const ORDER_TYPE_MAP: Record<PlacePaperOrderInput["orderType"], PaperOrderType> = {
  MARKET: "MARKET",
  LIMIT: "LIMIT",
  SL: "SL",
  "SL-M": "SL_M",
};

function toPrismaOrderType(t: PlacePaperOrderInput["orderType"]): PaperOrderType {
  return ORDER_TYPE_MAP[t];
}

async function getWalletWithTrades(userId: number) {
  let wallet = await prisma.virtualWallet.findUnique({
    where: { userId },
    include: { trades: { orderBy: { tradedAt: "asc" } } },
  });
  if (!wallet) {
    wallet = await prisma.virtualWallet.create({
      data: { userId, balance: 1_000_000, currency: "INR" },
      include: { trades: true },
    });
  }
  return wallet;
}

function tradeHistory(wallet: { trades: { symbol: string; side: string; quantity: unknown; price: unknown; tradedAt: Date }[] }): VirtualTradeRow[] {
  return wallet.trades.map(t => ({
    symbol: t.symbol,
    side: t.side as "buy" | "sell",
    quantity: Number(t.quantity),
    price: Number(t.price),
    tradedAt: t.tradedAt,
  }));
}

/** Execute fill at price — creates trade + updates wallet. */
async function executeFill(params: {
  walletId: number;
  userId: number;
  orderId: number;
  symbol: string;
  side: TradeSide;
  quantity: number;
  executionPrice: number;
}) {
  const wallet = await prisma.virtualWallet.findUnique({
    where: { id: params.walletId },
    include: { trades: { orderBy: { tradedAt: "asc" } } },
  });
  if (!wallet) throw new Error("Wallet not found");

  const cost = params.quantity * params.executionPrice;
  const history = tradeHistory(wallet);

  if (params.side === "buy" && Number(wallet.balance) < cost) {
    await prisma.paperOrder.update({
      where: { id: params.orderId },
      data: {
        status: "REJECTED",
        rejectReason: "Insufficient virtual balance",
      },
    });
    throw new Error("Insufficient virtual balance");
  }

  if (params.side === "sell") {
    const available = getSellableQuantity(params.symbol, history);
    if (params.quantity > available) {
      await prisma.paperOrder.update({
        where: { id: params.orderId },
        data: {
          status: "REJECTED",
          rejectReason: `Insufficient holdings (max ${available})`,
        },
      });
      throw new Error(`Insufficient holdings. You can sell at most ${available} units`);
    }
  }

  const trade = await prisma.tradeVirtual.create({
    data: {
      walletId: params.walletId,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      price: params.executionPrice,
    },
  });

  const newBalance =
    params.side === "buy"
      ? Number(wallet.balance) - cost
      : Number(wallet.balance) + cost;

  await prisma.virtualWallet.update({
    where: { id: params.walletId },
    data: { balance: newBalance },
  });

  await prisma.paperOrder.update({
    where: { id: params.orderId },
    data: {
      status: "EXECUTED",
      executionPrice: params.executionPrice,
      executedAt: new Date(),
      tradeId: trade.id,
    },
  });

  return { trade, newBalance, executionPrice: params.executionPrice };
}

function shouldExecuteLimit(
  side: TradeSide,
  limitPrice: number,
  ltp: number,
): boolean {
  if (side === "buy") return ltp <= limitPrice;
  return ltp >= limitPrice;
}

function shouldTriggerSl(
  side: TradeSide,
  triggerPrice: number,
  ltp: number,
): boolean {
  if (side === "sell") return ltp <= triggerPrice;
  return ltp >= triggerPrice;
}

/** Try to fill a pending order at given LTP. */
export async function tryFillOrder(
  orderId: number,
  ltp: number,
): Promise<{ filled: boolean; executionPrice?: number }> {
  const order = await prisma.paperOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING") return { filled: false };

  const side = order.side;
  const qty = Number(order.quantity);
  const orderType = order.orderType;
  const limit = order.limitPrice != null ? Number(order.limitPrice) : null;
  const trigger = order.triggerPrice != null ? Number(order.triggerPrice) : null;

  if (orderType === "MARKET") {
    await executeFill({
      walletId: order.walletId,
      userId: order.userId,
      orderId: order.id,
      symbol: order.symbol,
      side,
      quantity: qty,
      executionPrice: ltp,
    });
    return { filled: true, executionPrice: ltp };
  }

  if (orderType === "LIMIT" && limit != null) {
    if (!shouldExecuteLimit(side, limit, ltp)) return { filled: false };
    const execPrice = side === "buy" ? Math.min(ltp, limit) : Math.max(ltp, limit);
    await executeFill({
      walletId: order.walletId,
      userId: order.userId,
      orderId: order.id,
      symbol: order.symbol,
      side,
      quantity: qty,
      executionPrice: execPrice,
    });
    return { filled: true, executionPrice: execPrice };
  }

  if ((orderType === "SL" || orderType === "SL_M") && trigger != null) {
    if (!shouldTriggerSl(side, trigger, ltp)) return { filled: false };
    const execPrice = orderType === "SL_M" ? ltp : limit ?? ltp;
    await executeFill({
      walletId: order.walletId,
      userId: order.userId,
      orderId: order.id,
      symbol: order.symbol,
      side,
      quantity: qty,
      executionPrice: execPrice,
    });
    return { filled: true, executionPrice: execPrice };
  }

  return { filled: false };
}

export async function placePaperOrder(input: PlacePaperOrderInput) {
  const symbol = normalizePaperSymbol(input.symbol);
  const quantity = input.quantity;
  const side = input.side as TradeSide;
  const orderType = toPrismaOrderType(input.orderType);
  const wallet = await getWalletWithTrades(input.userId);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be positive");
  }

  const order = await prisma.paperOrder.create({
    data: {
      walletId: wallet.id,
      userId: input.userId,
      symbol,
      tradingSymbol: input.tradingSymbol ?? symbol,
      token: input.token,
      exchange: input.exchange ?? "NSE",
      side,
      orderType,
      product: input.product ?? "CNC",
      quantity,
      limitPrice: input.limitPrice,
      triggerPrice: input.triggerPrice,
      status: "PENDING",
    },
  });

  if (input.orderType === "MARKET") {
    try {
      const ltp = await fetchLiveLtp({
        symbol,
        token: input.token,
        exchange: input.exchange,
        tradingSymbol: input.tradingSymbol,
      });
      const result = await tryFillOrder(order.id, ltp);
      const updated = await prisma.paperOrder.findUnique({ where: { id: order.id } });
      return {
        order: updated!,
        executed: result.filled,
        executionPrice: result.executionPrice,
        message: result.filled
          ? `Market ${input.side.toUpperCase()} filled @ ₹${result.executionPrice!.toLocaleString("en-IN")}`
          : "Market order pending",
      };
    } catch (e) {
      await prisma.paperOrder.update({
        where: { id: order.id },
        data: {
          status: "REJECTED",
          rejectReason: e instanceof Error ? e.message : "Price fetch failed",
        },
      });
      throw e;
    }
  }

  if (input.orderType === "LIMIT" && input.limitPrice != null) {
    try {
      const ltp = await fetchLiveLtp({
        symbol,
        token: input.token,
        exchange: input.exchange,
      });
      if (shouldExecuteLimit(side, input.limitPrice, ltp)) {
        const result = await tryFillOrder(order.id, ltp);
        const updated = await prisma.paperOrder.findUnique({ where: { id: order.id } });
        return {
          order: updated!,
          executed: result.filled,
          executionPrice: result.executionPrice,
          message: result.filled
            ? `Limit ${input.side.toUpperCase()} filled @ ₹${result.executionPrice!.toLocaleString("en-IN")}`
            : `Limit order placed @ ₹${input.limitPrice}`,
        };
      }
    } catch {
      /* no live price — stay pending */
    }
    return {
      order,
      executed: false,
      message: `Limit order pending @ ₹${input.limitPrice.toLocaleString("en-IN")}`,
    };
  }

  return {
    order,
    executed: false,
    message:
      input.orderType === "SL" || input.orderType === "SL-M"
        ? `Stop order pending — trigger ₹${(input.triggerPrice ?? 0).toLocaleString("en-IN")}`
        : "Order pending",
  };
}

export async function cancelPaperOrder(userId: number, orderId: number) {
  const order = await prisma.paperOrder.findFirst({
    where: { id: orderId, userId, status: "PENDING" },
  });
  if (!order) throw new Error("Order not found or cannot be cancelled");
  return prisma.paperOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });
}

/** Process all pending orders for user against live quotes. */
export async function matchPendingOrders(userId: number, quotes: LiveQuote[]) {
  const ltpBySymbol: Record<string, number> = {};
  for (const q of quotes) {
    if (q.ltp > 0) ltpBySymbol[normalizePaperSymbol(q.symbol)] = q.ltp;
  }

  const pending = await prisma.paperOrder.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  const filled: number[] = [];
  for (const order of pending) {
    const ltp = ltpBySymbol[order.symbol];
    if (ltp == null) continue;
    try {
      const r = await tryFillOrder(order.id, ltp);
      if (r.filled) filled.push(order.id);
    } catch {
      /* rejected or failed — status updated in engine */
    }
  }

  return { matched: filled.length, order_ids: filled };
}

export function serializePaperOrder(order: {
  id: number;
  symbol: string;
  tradingSymbol: string | null;
  side: string;
  orderType: string;
  product: string;
  quantity: unknown;
  limitPrice: unknown;
  triggerPrice: unknown;
  executionPrice: unknown;
  status: string;
  rejectReason: string | null;
  createdAt: Date;
  executedAt: Date | null;
}) {
  const typeLabel =
    order.orderType === "SL_M"
      ? "SL-M"
      : order.orderType === "SL"
        ? "SL"
        : order.orderType;
  return {
    id: order.id,
    symbol: order.symbol,
    trading_symbol: order.tradingSymbol,
    side: order.side.toUpperCase(),
    order_type: typeLabel,
    product: order.product,
    quantity: Number(order.quantity),
    limit_price: order.limitPrice != null ? Number(order.limitPrice) : null,
    trigger_price: order.triggerPrice != null ? Number(order.triggerPrice) : null,
    execution_price: order.executionPrice != null ? Number(order.executionPrice) : null,
    status: order.status,
    reject_reason: order.rejectReason,
    created_at: order.createdAt.toISOString(),
    executed_at: order.executedAt?.toISOString() ?? null,
  };
}
