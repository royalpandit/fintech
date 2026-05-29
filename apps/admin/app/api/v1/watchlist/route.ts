import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { watchlistItemPayload } from "@/lib/watchlist-db";

/** @deprecated Use /api/v1/watchlists — kept for backward compatibility. */

async function getOrCreateDefaultWatchlist(userId: number) {
  let list = await prisma.watchlist.findFirst({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  if (!list) {
    list = await prisma.watchlist.create({
      data: { userId, name: "My Portfolio", sortOrder: 0 },
      include: { items: true },
    });
  }
  return list;
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const list = await getOrCreateDefaultWatchlist(auth.userId);
  return ok({
    watchlist: {
      id: list.id,
      name: list.name,
      items: list.items.map(i => ({
        id: i.id,
        symbol: i.symbol,
        asset_type: i.assetType,
        notes: i.notes,
        added_at: i.addedAt.toISOString(),
      })),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{
    symbol?: string;
    assetType?: "equity" | "crypto" | "mf" | "commodity" | "other";
    notes?: string;
  }>(req);

  const symbol = (body.symbol ?? "").trim().toUpperCase();
  if (!symbol) return err("symbol is required");

  const assetType = body.assetType ?? "equity";
  const list = await getOrCreateDefaultWatchlist(auth.userId);

  const payload = watchlistItemPayload({
    display: symbol,
    tradingSymbol: symbol,
    token: symbol,
    exchange: "NSE",
    type: "EQ",
  });

  const item = await prisma.watchlistItem.upsert({
    where: {
      watchlistId_instrumentKey: { watchlistId: list.id, instrumentKey: payload.instrumentKey },
    },
    update: { assetType, notes: body.notes?.trim() || null, ...payload },
    create: {
      watchlistId: list.id,
      ...payload,
      assetType,
      notes: body.notes?.trim() || null,
    },
  });

  return ok({
    item: {
      id: item.id,
      symbol: item.symbol,
      asset_type: item.assetType,
      notes: item.notes,
      added_at: item.addedAt.toISOString(),
    },
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const symbol = new URL(req.url).searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) return err("symbol query param is required");

  const lists = await prisma.watchlist.findMany({ where: { userId: auth.userId } });
  for (const list of lists) {
    await prisma.watchlistItem.deleteMany({
      where: {
        watchlistId: list.id,
        OR: [{ symbol }, { instrumentKey: { contains: symbol } }],
      },
    });
  }

  return ok({ removed: true, symbol });
}
