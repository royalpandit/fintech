import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  if (!Number.isFinite(id)) return err("Invalid id");

  // Advisor can only soft-delete comments on their own posts.
  const comment = await prisma.marketComment.findFirst({
    where: { id, deletedAt: null },
    include: { post: { select: { advisorUserId: true } } },
  });

  if (!comment) return err("Comment not found", 404);
  if (comment.post.advisorUserId !== auth.userId) return err("Forbidden", 403);

  await prisma.marketComment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "comment_hidden_by_advisor",
      module: "market_posts",
      targetKind: "market_comment",
      targetId: id,
    },
  });

  return ok({ id, deleted: true });
}
