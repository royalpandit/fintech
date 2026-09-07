import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const body = await parseBody<{ broker_name?: string }>(req);
  if (!body.broker_name) return err("broker_name is required");

  const account = await prisma.brokerAccount.upsert({
    where: {
      userId_brokerName: { userId, brokerName: body.broker_name },
    },
    update: { lastSyncedAt: new Date() },
    create: { userId, brokerName: body.broker_name },
  });

  // Give the broker its own portfolio, matched on (user, name). Keying the
  // upsert on `account.id` treated a broker-account id as a portfolio id, so it
  // could overwrite an unrelated user's portfolio row.
  const existingPortfolio = await prisma.portfolio.findFirst({
    where: { userId, source: "broker", name: body.broker_name, deletedAt: null },
    select: { id: true },
  });
  if (!existingPortfolio) {
    await prisma.portfolio.create({
      data: { userId, source: "broker", name: body.broker_name },
    });
  }

  return ok({ connected: true, broker: body.broker_name, account_id: account.id });
}


/**
 * DELETE /api/v1/portfolio/connect?broker=Zerodha
 *
 * Unlink a broker. The account row goes; the portfolio is only soft-deleted.
 *
 * That distinction matters: Portfolio cascades to tradesReal and assets, so a
 * hard delete would take the user's entire real trade history with it because
 * they unlinked an account. Setting deletedAt hides it everywhere (every query
 * already filters on deletedAt: null) and reconnecting the same broker later
 * revives the same portfolio rather than starting a second one.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const broker = (req.nextUrl.searchParams.get("broker") ?? "").trim();
  if (!broker) return err("broker is required");

  const account = await prisma.brokerAccount.findUnique({
    where: { userId_brokerName: { userId, brokerName: broker } },
    select: { id: true },
  });
  if (!account) return err("That broker is not connected", 404);

  await prisma.brokerAccount.delete({ where: { id: account.id } });
  await prisma.portfolio.updateMany({
    where: { userId, source: "broker", name: broker, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return ok({ disconnected: true, broker });
}
