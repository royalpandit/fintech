import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const postId = Number(params.id);
  const post = await prisma.communityPost.findFirst({
    where: { id: postId, deletedAt: null },
  });
  if (!post) return err("Post not found", 404);

  const existing = await prisma.communityReaction.findFirst({
    where: { postId, userId: auth.userId, type: "like" },
  });

  if (existing) {
    await prisma.communityReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.communityReaction.create({
      data: { postId, userId: auth.userId, type: "like" },
    });
  }

  const count = await prisma.communityReaction.count({ where: { postId, type: "like" } });
  return ok({ liked: !existing, count });
}
