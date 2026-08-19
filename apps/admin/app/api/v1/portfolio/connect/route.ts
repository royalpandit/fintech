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
