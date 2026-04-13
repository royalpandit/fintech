import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

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
