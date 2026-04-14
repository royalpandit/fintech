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

  await prisma.portfolio.upsert({
    where: { id: account.id },
    update: {},
    create: { userId, source: "broker", name: body.broker_name },
  });

  return ok({ connected: true, broker: body.broker_name });
}
