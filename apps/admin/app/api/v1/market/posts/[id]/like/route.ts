import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

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
