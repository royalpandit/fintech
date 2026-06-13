import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { getBoostTier } from "@/lib/post-boost";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  if (!Number.isInteger(id)) return err("Invalid post id");

  const body = await parseBody<{ tier?: string }>(req);
  const tier = getBoostTier(body.tier);
  if (!tier) return err("Pick a valid boost plan");

  const post = await prisma.marketPost.findFirst({
    where: { id, advisorUserId: auth.userId, deletedAt: null },
    select: { id: true, complianceStatus: true, boostedUntil: true },
  });
  if (!post) return err("Post not found", 404);
  if (post.complianceStatus !== "approved") {
    return err("Only approved posts can be boosted");
  }

  // Extend from the current boost end if one is still active, otherwise from now.
  const base =
    post.boostedUntil && new Date(post.boostedUntil).getTime() > Date.now()
      ? new Date(post.boostedUntil)
      : new Date();
  const boostedUntil = new Date(base.getTime() + tier.days * 24 * 60 * 60 * 1000);

  const updated = await prisma.marketPost.update({
    where: { id },
    data: { boostedUntil, boostTier: tier.id },
    select: { id: true, boostedUntil: true, boostTier: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "post_boosted",
      module: "market_posts",
      targetKind: "market_post",
      targetId: id,
    },
  });

  return ok({ post: updated });
}
