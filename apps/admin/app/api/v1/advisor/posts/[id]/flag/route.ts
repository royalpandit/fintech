import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Let an advisor flag their own post for review.
 *
 * The posts list has had a "Flagged" tab since before anything could put a post
 * into that state from the advisor side — only the automatic phrase scan could.
 * This is the manual route: pull your own post out of circulation and hand it to
 * the moderation queue.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const postId = Number(params.id);
  if (!Number.isFinite(postId)) return err("Invalid id");

  const body = await parseBody<{ reason?: string }>(req);
  const reason = body.reason?.trim().slice(0, 500) || null;

  const post = await prisma.marketPost.findFirst({
    where: { id: postId, advisorUserId: auth.userId, deletedAt: null },
    select: { id: true, complianceStatus: true, title: true },
  });
  if (!post) return err("Post not found", 404);
  if (post.complianceStatus === "flagged") {
    return err("This post is already flagged for review", 409);
  }

  // Flagging unpublishes it — a post awaiting review shouldn't stay live.
  const updated = await prisma.marketPost.update({
    where: { id: postId },
    data: {
      complianceStatus: "flagged",
      publishedAt: null,
      boostedUntil: null,
      boostTier: null,
    },
    select: { id: true, complianceStatus: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "post_flagged_by_author",
      module: "market_posts",
      targetKind: "market_post",
      targetId: postId,
      payload: (reason ? { reason } : {}) as never,
    },
  });

  return ok({ post: updated });
}
