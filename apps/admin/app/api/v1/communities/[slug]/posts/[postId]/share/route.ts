import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { getGroupBySlug, canInteract, notifyUser } from "@/lib/community";

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

    const canShare = await canInteract(group, auth.userId);
    if (!canShare) return err("You must be a member to share", 403);

    const postId = Number(params.postId);
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, groupId: group.id, deletedAt: null },
      select: { id: true, userId: true, title: true, content: true },
    });
    if (!post) return err("Post not found", 404);

    await prisma.$transaction([
      prisma.communityPostShare.create({
        data: { postId, userId: auth.userId },
      }),
      prisma.communityPost.update({
        where: { id: postId },
        data: { shareCount: { increment: 1 } },
      }),
    ]);

    if (post.userId !== auth.userId) {
      const sharer = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { fullName: true },
      });
      await notifyUser(
        post.userId,
        "Post shared",
        `${sharer?.fullName ?? "Someone"} shared your post.`,
        { type: "post_share", postId, groupId: group.id },
      );
    }

    const updated = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { shareCount: true },
    });

    return ok({ share_count: updated?.shareCount ?? 0 });
  } catch (e) {
    console.error("[POST /communities/:slug/posts/:postId/share]", e);
    return err(e instanceof Error ? e.message : "Failed to share post", 500);
  }
}
