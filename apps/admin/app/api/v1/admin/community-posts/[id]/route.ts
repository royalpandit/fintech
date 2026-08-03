import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Soft-delete a community post (moderation take-down).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  if (!Number.isFinite(id)) return err("Invalid post id", 400);

  const existing = await prisma.communityPost.findUnique({ where: { id } });
  if (!existing) return err("Post not found", 404);
  if (existing.deletedAt) return ok({ post: existing });

  const post = await prisma.communityPost.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "community_post_removed",
      module: "community",
      targetKind: "community_post",
      targetId: id,
    },
  });

  return ok({ post });
}

// Restore a soft-deleted post.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  if (!Number.isFinite(id)) return err("Invalid post id", 400);

  const post = await prisma.communityPost.update({
    where: { id },
    data: { deletedAt: null },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "community_post_restored",
      module: "community",
      targetKind: "community_post",
      targetId: id,
    },
  });

  return ok({ post });
}
