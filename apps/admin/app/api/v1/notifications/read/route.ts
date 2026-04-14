import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

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
