import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { itemToWatchlist } from "@/lib/watchlist-db";

export const dynamic = "force-dynamic";

function serializeList(
  list: {
    id: number;
    name: string;
    sortOrder: number;
    items: {
      id: number;
      symbol: string;
      instrumentKey: string;
      displayName: string | null;
      tradingSymbol: string | null;
      token: string | null;
      exchange: string | null;
      instrumentType: string | null;
      sortOrder: number;
      addedAt: Date;
    }[];
  },
) {
  return {
    id: list.id,
    name: list.name,
    sort_order: list.sortOrder,
    items: list.items
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map(i => {
        const mapped = itemToWatchlist(i);
        return {
          id: i.id,
          instrument_key: i.instrumentKey,
          sort_order: i.sortOrder,
          added_at: i.addedAt.toISOString(),
          display: mapped.display,
          tradingSymbol: mapped.tradingSymbol,
          token: mapped.token,
          exchange: mapped.exchange,
          type: mapped.type,
        };
      }),
  };
}

async function ensureUserWatchlists(userId: number) {
  const count = await prisma.watchlist.count({ where: { userId } });
  if (count > 0) return;
  await prisma.watchlist.create({
    data: { userId, name: "My Portfolio", sortOrder: 0 },
  });
}

/** GET — all watchlists + items. POST — create watchlist. PATCH — reorder tabs. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    await ensureUserWatchlists(auth.userId);

    const lists = await prisma.watchlist.findMany({
      where: { userId: auth.userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
    });

    return ok({ watchlists: lists.map(serializeList) });
  } catch (e) {
    console.error("[watchlists GET]", e);
    const msg = e instanceof Error ? e.message : "Failed to load watchlists";
    return err(msg.includes("instrument_key") || msg.includes("sort_order") ? "Watchlist database needs migration — contact admin" : msg, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const body = await parseBody<{ name?: string }>(req);
    const name = (body.name ?? "").trim();
    if (!name || name.length > 120) return err("Watchlist name is required (max 120 chars)");

    const maxOrder = await prisma.watchlist.aggregate({
      where: { userId: auth.userId },
      _max: { sortOrder: true },
    });

    const list = await prisma.watchlist.create({
      data: {
        userId: auth.userId,
        name,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: { items: true },
    });

    return ok({ watchlist: serializeList(list) });
  } catch (e) {
    console.error("[watchlists POST]", e);
    return err(e instanceof Error ? e.message : "Failed to create watchlist", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{ order?: { id: number; sort_order: number }[] }>(req);
  const order = body.order ?? [];
  if (!order.length) return err("order array required");

  await prisma.$transaction(
    order.map(row =>
      prisma.watchlist.updateMany({
        where: { id: row.id, userId: auth.userId },
        data: { sortOrder: row.sort_order },
      }),
    ),
  );

  return ok({ updated: order.length });
}
