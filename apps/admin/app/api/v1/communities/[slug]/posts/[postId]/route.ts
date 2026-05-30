import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  getGroupBySlug,
  canViewPosts,
  canInteract,
  hasRole,
  MOD_ROLES,
} from "@/lib/community";
import { serializeSocialPost, socialPostInclude } from "@/lib/social-feed-serialize";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; postId: string } },
) {
  try {
    const auth = await requireAuth(req);
    const userId = auth?.userId ?? null;
    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const canView = await canViewPosts(group, userId);
    if (!canView) return err("Join this community to view posts", 403);

    const postId = Number(params.postId);
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, groupId: group.id, deletedAt: null },
      include: socialPostInclude,
    });
    if (!post) return err("Post not found", 404);

    const [like, save, unlock] = userId
      ? await Promise.all([
          prisma.communityReaction.findFirst({ where: { userId, postId, type: "like" } }),
          prisma.communityPostSave.findFirst({ where: { userId, postId } }),
          prisma.communityPostUnlock.findFirst({ where: { userId, postId } }),
        ])
      : [null, null, null];

    const serialized = serializeSocialPost(post, {
      userId,
      likedIds: new Set(like ? [postId] : []),
      savedIds: new Set(save ? [postId] : []),
      unlockedIds: new Set(unlock ? [postId] : []),
    });

    return ok({ post: serialized });
  } catch (e) {
    console.error("[GET /communities/:slug/posts/:postId]", e);
    return err(e instanceof Error ? e.message : "Failed to load post", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; postId: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const postId = Number(params.postId);
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, groupId: group.id, deletedAt: null },
    });
    if (!post) return err("Post not found", 404);
    if (post.userId !== auth.userId) {
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
      });
      if (!hasRole(member?.role, MOD_ROLES)) return err("Forbidden", 403);
    }

    const body = await parseBody<{ title?: string; content?: string }>(req);
    const updated = await prisma.communityPost.update({
      where: { id: postId },
      data: {
        title: body.title !== undefined ? body.title?.trim() || null : undefined,
        content: body.content !== undefined ? body.content.trim() : undefined,
      },
      include: socialPostInclude,
    });

    return ok({
      post: serializeSocialPost(updated, {
        userId: auth.userId,
        likedIds: new Set(),
        savedIds: new Set(),
        unlockedIds: new Set(),
      }),
    });
  } catch (e) {
    console.error("[PATCH /communities/:slug/posts/:postId]", e);
    return err(e instanceof Error ? e.message : "Failed to update post", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string; postId: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const postId = Number(params.postId);
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, groupId: group.id, deletedAt: null },
    });
    if (!post) return err("Post not found", 404);

    if (post.userId !== auth.userId) {
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
      });
      if (!hasRole(member?.role, MOD_ROLES)) return err("Forbidden", 403);
    }

    await prisma.communityPost.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    return ok({ deleted: true });
  } catch (e) {
    console.error("[DELETE /communities/:slug/posts/:postId]", e);
    return err(e instanceof Error ? e.message : "Failed to delete post", 500);
  }
}
