import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const blockerId = auth.userId;
  const blockedId = Number(params.id);

  if (blockerId === blockedId) return err("Cannot block yourself");

  // Use dynamic prisma access so the type is resolved after prisma generate
  const prisma = (await import("@/lib/prisma")).prisma;
  await (prisma as any).userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    update: {},
    create: { blockerId, blockedId },
  });

  return ok({ blocked: blockedId });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const blockerId = auth.userId;
  const blockedId = Number(params.id);

  const prisma = (await import("@/lib/prisma")).prisma;
  await (prisma as any).userBlock.deleteMany({
    where: { blockerId, blockedId },
  });

  return ok({ unblocked: blockedId });
}
