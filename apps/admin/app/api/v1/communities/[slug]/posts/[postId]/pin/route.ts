import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { getGroupBySlug, hasRole, MOD_ROLES } from "@/lib/community";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; postId: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
    });
    if (!hasRole(member?.role, MOD_ROLES)) return err("Forbidden", 403);

    const postId = Number(params.postId);
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, groupId: group.id, deletedAt: null },
    });
    if (!post) return err("Post not found", 404);

    const pinned = post.pinnedAt != null;
    await prisma.communityPost.update({
      where: { id: postId },
      data: { pinnedAt: pinned ? null : new Date() },
    });

    return ok({ pinned: !pinned });
  } catch (e) {
    console.error("[POST /communities/:slug/posts/:postId/pin]", e);
    return err(e instanceof Error ? e.message : "Failed to pin post", 500);
  }
}
