import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const body = await parseBody<{ ids?: number[] }>(req);

  if (!body.ids || body.ids.length === 0) {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ marked_read: "all" });
  }

  await prisma.notification.updateMany({
    where: { id: { in: body.ids }, userId },
    data: { readAt: new Date() },
  });

  return ok({ marked_read: body.ids });
}
