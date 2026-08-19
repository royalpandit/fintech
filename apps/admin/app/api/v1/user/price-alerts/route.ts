import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Price alerts. The `PriceAlert` model shipped with no code behind it — this is
 * the CRUD; `lib/price-alert-engine.ts` evaluates them from the cron tick.
 */

const MAX_PER_USER = 50;

function serialize(a: {
  id: number;
  symbol: string;
  targetPrice: unknown;
  direction: string;
  isTriggered: boolean;
  triggeredAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    symbol: a.symbol,
    target_price: Number(a.targetPrice),
    direction: a.direction,
    is_triggered: a.isTriggered,
    triggered_at: a.triggeredAt?.toISOString() ?? null,
    created_at: a.createdAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const alerts = await prisma.priceAlert.findMany({
    where: { userId: auth.userId },
    orderBy: [{ isTriggered: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return ok({ data: alerts.map(serialize) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{
    symbol?: string;
    targetPrice?: number | string;
    direction?: string;
    assetType?: string;
  }>(req);

  const symbol = (body.symbol ?? "").trim().toUpperCase();
  const targetPrice = Number(body.targetPrice);
  const direction = body.direction === "below" ? "below" : "above";

  if (!symbol) return err("symbol is required");
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    return err("A valid target price is required");
  }

  const active = await prisma.priceAlert.count({
    where: { userId: auth.userId, isTriggered: false },
  });
  if (active >= MAX_PER_USER) {
    return err(`You can have at most ${MAX_PER_USER} active alerts`, 409);
  }

  // Don't stack identical alerts — the engine would fire them together.
  const duplicate = await prisma.priceAlert.findFirst({
    where: { userId: auth.userId, symbol, targetPrice, direction, isTriggered: false },
    select: { id: true },
  });
  if (duplicate) return err("You already have that alert", 409);

  const alert = await prisma.priceAlert.create({
    data: {
      userId: auth.userId,
      symbol,
      targetPrice,
      direction,
      ...(body.assetType ? { assetType: body.assetType as "equity" } : {}),
    },
  });
  return ok({ alert: serialize(alert) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return err("id is required");

  // Scope the delete to the owner so an id can't be used to remove someone
  // else's alert.
  const deleted = await prisma.priceAlert.deleteMany({
    where: { id, userId: auth.userId },
  });
  if (!deleted.count) return err("Alert not found", 404);

  return ok({ deleted: id });
}
