import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

async function getOrCreateDefaultWatchlist(userId: number) {
  let list = await prisma.watchlist.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: { addedAt: "desc" } } },
  });
  if (!list) {
    list = await prisma.watchlist.create({
      data: { userId, name: "Default" },
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
      items: list.items.map((i) => ({
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
  if (!symbol || symbol.length < 1) return err("symbol is required");

  const assetType = body.assetType ?? "equity";
  const list = await getOrCreateDefaultWatchlist(auth.userId);

  const item = await prisma.watchlistItem.upsert({
    where: { watchlistId_symbol: { watchlistId: list.id, symbol } },
    update: {
      assetType,
      notes: body.notes?.trim() || null,
    },
    create: {
      watchlistId: list.id,
      symbol,
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

  const list = await prisma.watchlist.findFirst({ where: { userId: auth.userId } });
  if (!list) return ok({ removed: false });

  await prisma.watchlistItem.deleteMany({
    where: { watchlistId: list.id, symbol },
  });

  return ok({ removed: true, symbol });
}
