import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const postId = Number(params.id);

  const existing = await prisma.marketReaction.findFirst({
    where: { postId, userId, type: "like" },
  });

  if (existing) {
    await prisma.marketReaction.delete({ where: { id: existing.id } });
    return ok({ post_id: postId, liked: false });
  }

  await prisma.marketReaction.create({
    data: { postId, userId, type: "like" },
  });

  return ok({ post_id: postId, liked: true });
}
