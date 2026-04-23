import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

async function assertOwnership(postId: number, userId: number) {
  const post = await prisma.marketPost.findFirst({
    where: { id: postId, advisorUserId: userId, deletedAt: null },
    select: { id: true, complianceStatus: true },
  });
  return post;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const postId = Number(params.id);
  if (!Number.isFinite(postId)) return err("Invalid id");

  const post = await prisma.marketPost.findFirst({
    where: { id: postId, advisorUserId: auth.userId, deletedAt: null },
    include: {
      _count: { select: { comments: true, reactions: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { fullName: true } } },
      },
    },
  });

  if (!post) return err("Post not found", 404);
  return ok({ post });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const postId = Number(params.id);
  if (!Number.isFinite(postId)) return err("Invalid id");

  const existing = await assertOwnership(postId, auth.userId);
  if (!existing) return err("Post not found", 404);

  // Approved posts cannot be edited — create a new one instead.
  if (existing.complianceStatus === "approved") {
    return err("Approved posts cannot be edited. Create a new post instead.", 400);
  }

  const body = await parseBody<{
    title?: string;
    content?: string;
    marketSymbol?: string;
    timeframe?: string;
    targetPrice?: number | null;
    stopLossPrice?: number | null;
    disclaimer?: string;
  }>(req);

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    if (body.title.trim().length < 5) return err("Title too short");
    data.title = body.title.trim();
  }
  if (typeof body.content === "string") {
    if (body.content.trim().length < 20) return err("Content too short");
    data.content = body.content.trim();
  }
  if (typeof body.disclaimer === "string") {
    if (body.disclaimer.trim().length < 20) return err("Disclaimer too short");
    data.disclaimer = body.disclaimer.trim();
  }
  if ("marketSymbol" in body) data.marketSymbol = body.marketSymbol?.trim() || null;
  if ("timeframe" in body) data.timeframe = body.timeframe?.trim() || null;
  if ("targetPrice" in body) data.targetPrice = body.targetPrice ?? null;
  if ("stopLossPrice" in body) data.stopLossPrice = body.stopLossPrice ?? null;

  // Any edit resets compliance to pending for re-review.
  data.complianceStatus = "pending";
  data.editedAt = new Date();

  const updated = await prisma.marketPost.update({
    where: { id: postId },
    data,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "post_edited",
      module: "market_posts",
      targetKind: "market_post",
      targetId: postId,
    },
  });

  return ok({ post: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const postId = Number(params.id);
  if (!Number.isFinite(postId)) return err("Invalid id");

  const existing = await assertOwnership(postId, auth.userId);
  if (!existing) return err("Post not found", 404);

  await prisma.marketPost.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "post_deleted",
      module: "market_posts",
      targetKind: "market_post",
      targetId: postId,
    },
  });

  return ok({ id: postId, deleted: true });
}
