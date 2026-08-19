import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyTradeStatus } from "@/lib/notify";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";
import {
  isTradeUpdateKind,
  STATUS_FOR_UPDATE_KIND,
  TRADE_UPDATE_KINDS,
  tradeSide,
  exitReturnPct,
  type TradeUpdateKind,
} from "@/lib/trades";

export const dynamic = "force-dynamic";

// Trades Phase 1 — the trade timeline ("Entry Triggered", "SL Moved to Cost", …).
// See TRADES-PHASE1-2-CHANGES.md.

/** GET — timeline for a trade (readable by anyone who can see the post). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await requireAuth(req); // optional — public trades are readable by guests
  const postId = Number(params.id);
  if (!Number.isFinite(postId)) return err("Invalid id");

  const updates = await prisma.marketPostUpdate.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
  });

  return ok({ data: updates });
}

/** POST — advisor logs an update; some kinds also move the trade's status. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const postId = Number(params.id);
  if (!Number.isFinite(postId)) return err("Invalid id");

  const post = await prisma.marketPost.findFirst({
    where: { id: postId, advisorUserId: auth.userId, deletedAt: null },
    select: {
      id: true,
      sentiment: true,
      entryPriceMin: true,
      entryPriceMax: true,
      title: true,
      marketSymbol: true,
      advisorUserId: true,
      advisor: { select: { fullName: true } },
    },
  });
  if (!post) return err("Trade not found", 404);

  const body = await parseBody<{
    kind?: string;
    note?: string;
    title?: string;
    exitPrice?: number; // for kind === "exited"
  }>(req);
  if (!isTradeUpdateKind(body.kind) || body.kind === "published") {
    return err(
      "kind must be one of: entry_triggered, sl_moved, partial_booked, target_hit, sl_hit, exited, cancelled, note",
    );
  }
  const kind = body.kind as TradeUpdateKind;
  const title =
    body.title?.trim() ||
    TRADE_UPDATE_KINDS.find((k) => k.value === kind)?.label ||
    (kind === "exited" ? "Trade Exited" : kind === "cancelled" ? "Trade Cancelled" : "Update");

  const nextStatus = STATUS_FOR_UPDATE_KIND[kind];

  // Manual exit: capture exit price + reason and compute realised return.
  const marketData: Record<string, unknown> = {};
  if (nextStatus) marketData.tradeStatus = nextStatus;
  if (kind === "exited") {
    const exit = Number(body.exitPrice);
    if (!Number.isFinite(exit) || exit <= 0) return err("exitPrice is required to exit a trade");
    const ret = exitReturnPct({
      entryMin: post.entryPriceMin ? Number(post.entryPriceMin) : null,
      entryMax: post.entryPriceMax ? Number(post.entryPriceMax) : null,
      exit,
      side: tradeSide(post.sentiment),
    });
    marketData.exitPrice = exit;
    marketData.exitReason = body.note?.trim() || null;
    marketData.exitReturnPct = ret != null ? Number(ret.toFixed(2)) : null;
    marketData.closedAt = new Date();
  }
  if (kind === "cancelled" || kind === "target_hit" || kind === "sl_hit") {
    marketData.closedAt = new Date();
  }

  const [update] = await prisma.$transaction([
    prisma.marketPostUpdate.create({
      data: { postId, kind, title, note: body.note?.trim() || null },
    }),
    ...(Object.keys(marketData).length
      ? [prisma.marketPost.update({ where: { id: postId }, data: marketData })]
      : []),
  ]);

  // Tell everyone who could have acted on this call that it moved.
  if (nextStatus) {
    await notifyTradeStatus({
      postId,
      postTitle: post.title,
      symbol: post.marketSymbol,
      advisorUserId: post.advisorUserId,
      advisorName: post.advisor?.fullName ?? "An advisor you follow",
      status: nextStatus,
      returnPct:
        typeof marketData.exitReturnPct === "number" ? marketData.exitReturnPct : null,
    });
  }

  return ok({ data: update, tradeStatus: nextStatus ?? null });
}
