import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  if (!Number.isFinite(id)) return err("Invalid id");

  const notif = await prisma.notification.findFirst({
    where: { id, userId: auth.userId },
    select: { id: true, readAt: true },
  });
  if (!notif) return err("Notification not found", 404);

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: notif.readAt ?? new Date() },
  });

  return ok({ notification: updated });
}
