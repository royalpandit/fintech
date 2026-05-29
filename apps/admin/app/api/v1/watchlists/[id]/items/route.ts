import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { instrumentKey, itemToWatchlist, watchlistItemPayload } from "@/lib/watchlist-db";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function ownedList(userId: number, id: number) {
  return prisma.watchlist.findFirst({ where: { id, userId } });
}

/** POST — add symbol. DELETE — remove by instrument_key query. PATCH — reorder items. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const watchlistId = Number((await ctx.params).id);
    if (!Number.isFinite(watchlistId)) return err("Invalid watchlist id");

    const list = await ownedList(auth.userId, watchlistId);
    if (!list) return err("Watchlist not found", 404);

    const body = await parseBody<Partial<WatchlistItem>>(req);
    if (!body.token && !body.tradingSymbol) return err("token or tradingSymbol required");

    const item: WatchlistItem = {
      display: body.display ?? body.tradingSymbol ?? "",
      tradingSymbol: body.tradingSymbol ?? body.display ?? "",
      token: body.token ?? "",
      exchange: body.exchange ?? "NSE",
      type: body.type ?? "EQ",
    };

    const payload = watchlistItemPayload(item);
    const maxOrder = await prisma.watchlistItem.aggregate({
      where: { watchlistId },
      _max: { sortOrder: true },
    });

    const row = await prisma.watchlistItem.upsert({
      where: {
        watchlistId_instrumentKey: {
          watchlistId,
          instrumentKey: payload.instrumentKey,
        },
      },
      update: {
        ...payload,
        sortOrder: maxOrder._max.sortOrder ?? 0,
      },
      create: {
        watchlistId,
        ...payload,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return ok({
      item: {
        id: row.id,
        instrument_key: row.instrumentKey,
        ...itemToWatchlist(row),
      },
    });
  } catch (e) {
    console.error("[watchlist items POST]", e);
    return err(e instanceof Error ? e.message : "Failed to add symbol", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const watchlistId = Number((await ctx.params).id);
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("instrument_key");
  const itemId = searchParams.get("item_id");

  const list = await ownedList(auth.userId, watchlistId);
  if (!list) return err("Watchlist not found", 404);

  if (itemId) {
    await prisma.watchlistItem.deleteMany({
      where: { id: Number(itemId), watchlistId },
    });
    return ok({ removed: true });
  }

  if (!key) return err("instrument_key or item_id required");

  await prisma.watchlistItem.deleteMany({
    where: { watchlistId, instrumentKey: key },
  });

  return ok({ removed: true, instrument_key: key });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const watchlistId = Number((await ctx.params).id);
  const list = await ownedList(auth.userId, watchlistId);
  if (!list) return err("Watchlist not found", 404);

  const body = await parseBody<{ order?: { id: number; sort_order: number }[] }>(req);
  const order = body.order ?? [];
  if (!order.length) return err("order array required");

  await prisma.$transaction(
    order.map(row =>
      prisma.watchlistItem.updateMany({
        where: { id: row.id, watchlistId },
        data: { sortOrder: row.sort_order },
      }),
    ),
  );

  return ok({ updated: order.length });
}
