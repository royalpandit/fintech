import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const id = Number(params.id);
  await prisma.notification.updateMany({
    where: { id, userId: auth.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return ok({ id });
}
