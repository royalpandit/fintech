import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST — move item to another watchlist */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{ item_id?: number; target_watchlist_id?: number }>(req);
  const itemId = Number(body.item_id);
  const targetId = Number(body.target_watchlist_id);
  if (!Number.isFinite(itemId) || !Number.isFinite(targetId)) {
    return err("item_id and target_watchlist_id required");
  }

  const item = await prisma.watchlistItem.findFirst({
    where: { id: itemId, watchlist: { userId: auth.userId } },
  });
  if (!item) return err("Item not found", 404);

  const target = await prisma.watchlist.findFirst({
    where: { id: targetId, userId: auth.userId },
  });
  if (!target) return err("Target watchlist not found", 404);

  if (item.watchlistId === targetId) return ok({ moved: false, reason: "same list" });

  const exists = await prisma.watchlistItem.findUnique({
    where: {
      watchlistId_instrumentKey: {
        watchlistId: targetId,
        instrumentKey: item.instrumentKey,
      },
    },
  });
  if (exists) {
    await prisma.watchlistItem.delete({ where: { id: itemId } });
    return ok({ moved: true, merged: true });
  }

  const maxOrder = await prisma.watchlistItem.aggregate({
    where: { watchlistId: targetId },
    _max: { sortOrder: true },
  });

  await prisma.watchlistItem.update({
    where: { id: itemId },
    data: {
      watchlistId: targetId,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  return ok({ moved: true });
}
