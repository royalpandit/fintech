import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  getGroupBySlug,
  canViewPosts,
  canInteract,
  notifyUser,
} from "@/lib/community";

export const dynamic = "force-dynamic";

type CommentNode = {
  id: number;
  content: string;
  created_at: string;
  user: { id: number; fullName: string };
  parent_id: number | null;
  reply_count: number;
  replies: CommentNode[];
};

async function buildCommentTree(
  postId: number,
  parentId: number | null,
  depth: number,
  maxDepth: number,
  pageSize: number,
): Promise<CommentNode[]> {
  const comments = await prisma.communityComment.findMany({
    where: { postId, parentId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: pageSize,
    include: {
      user: { select: { id: true, fullName: true } },
      _count: { select: { replies: { where: { deletedAt: null } } } },
    },
  });

  return Promise.all(
    comments.map(async (c) => ({
      id: c.id,
      content: c.content,
      created_at: c.createdAt.toISOString(),
      user: c.user,
      parent_id: c.parentId,
      reply_count: c._count.replies,
      replies:
        depth < maxDepth
          ? await buildCommentTree(postId, c.id, depth + 1, maxDepth, pageSize)
          : [],
    })),
  );
}

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
    if (!canView) return err("Join this community to view comments", 403);

    const postId = Number(params.postId);
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parent_id");
    const cursor = Number(searchParams.get("cursor") || 0) || undefined;
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));

    if (parentId != null) {
      const pid = parentId === "null" ? null : Number(parentId);
      const rows = await prisma.communityComment.findMany({
        where: { postId, parentId: pid, deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          user: { select: { id: true, fullName: true } },
          _count: { select: { replies: { where: { deletedAt: null } } } },
        },
      });
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return ok({
        comments: page.map((c) => ({
          id: c.id,
          content: c.content,
          created_at: c.createdAt.toISOString(),
          user: c.user,
          parent_id: c.parentId,
          reply_count: c._count.replies,
          replies: [],
          is_own: userId === c.userId,
        })),
        next_cursor: hasMore ? page[page.length - 1].id : null,
      });
    }

    const comments = await buildCommentTree(postId, null, 0, 3, limit);
    return ok({ comments });
  } catch (e) {
    console.error("[GET comments]", e);
    return err(e instanceof Error ? e.message : "Failed to load comments", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; postId: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const canComment = await canInteract(group, auth.userId);
    if (!canComment) return err("You must be a member to comment", 403);

    const postId = Number(params.postId);
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, groupId: group.id, deletedAt: null },
      select: { id: true, userId: true, title: true },
    });
    if (!post) return err("Post not found", 404);

    const body = await parseBody<{ content?: string; parentId?: number }>(req);
    const content = body.content?.trim();
    if (!content) return err("content is required");

    if (body.parentId) {
      const parent = await prisma.communityComment.findFirst({
        where: { id: body.parentId, postId, deletedAt: null },
        select: { id: true, userId: true },
      });
      if (!parent) return err("Parent comment not found", 404);
    }

    const comment = await prisma.communityComment.create({
      data: {
        postId,
        userId: auth.userId,
        content,
        parentId: body.parentId ?? null,
      },
      include: { user: { select: { id: true, fullName: true } } },
    });

    const author = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true },
    });

    const notifyTarget =
      body.parentId
        ? (
            await prisma.communityComment.findUnique({
              where: { id: body.parentId },
              select: { userId: true },
            })
          )?.userId
        : post.userId;

    if (notifyTarget && notifyTarget !== auth.userId) {
      await notifyUser(
        notifyTarget,
        body.parentId ? "New reply" : "New comment",
        `${author?.fullName ?? "Someone"} ${body.parentId ? "replied to your comment" : "commented on your post"}.`,
        {
          type: body.parentId ? "comment_reply" : "post_comment",
          postId,
          commentId: comment.id,
          groupId: group.id,
          slug: group.slug,
        },
      );
    }

    const mentionMatch = content.match(/@(\w+)/g);
    if (mentionMatch) {
      for (const m of mentionMatch) {
        const namePart = m.slice(1);
        const mentioned = await prisma.user.findFirst({
          where: { fullName: { contains: namePart, mode: "insensitive" } },
          select: { id: true },
        });
        if (mentioned && mentioned.id !== auth.userId) {
          await notifyUser(
            mentioned.id,
            "You were mentioned",
            `${author?.fullName ?? "Someone"} mentioned you in a comment.`,
            { type: "mention", postId, commentId: comment.id },
          );
        }
      }
    }

    return ok({
      comment: {
        id: comment.id,
        content: comment.content,
        created_at: comment.createdAt.toISOString(),
        user: comment.user,
        parent_id: comment.parentId,
        reply_count: 0,
        replies: [],
        is_own: true,
      },
    });
  } catch (e) {
    console.error("[POST comments]", e);
    return err(e instanceof Error ? e.message : "Failed to add comment", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; postId: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const body = await parseBody<{ commentId?: number; content?: string }>(req);
    if (!body.commentId) return err("commentId is required");
    const content = body.content?.trim();
    if (!content) return err("content is required");

    const comment = await prisma.communityComment.findFirst({
      where: { id: body.commentId, postId: Number(params.postId), deletedAt: null },
    });
    if (!comment) return err("Comment not found", 404);
    if (comment.userId !== auth.userId) return err("Forbidden", 403);

    const updated = await prisma.communityComment.update({
      where: { id: body.commentId },
      data: { content },
      include: { user: { select: { id: true, fullName: true } } },
    });

    return ok({
      comment: {
        id: updated.id,
        content: updated.content,
        created_at: updated.createdAt.toISOString(),
        user: updated.user,
      },
    });
  } catch (e) {
    console.error("[PATCH comments]", e);
    return err(e instanceof Error ? e.message : "Failed to edit comment", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string; postId: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const commentId = Number(searchParams.get("commentId"));
    if (!commentId) return err("commentId is required");

    const comment = await prisma.communityComment.findFirst({
      where: { id: commentId, postId: Number(params.postId), deletedAt: null },
    });
    if (!comment) return err("Comment not found", 404);

    const group = await getGroupBySlug(params.slug);
    let canDelete = comment.userId === auth.userId;
    if (!canDelete && group) {
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
      });
      canDelete = member?.role === "owner" || member?.role === "admin" || member?.role === "moderator";
    }
    if (!canDelete) return err("Forbidden", 403);

    await prisma.communityComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return ok({ deleted: true });
  } catch (e) {
    console.error("[DELETE comments]", e);
    return err(e instanceof Error ? e.message : "Failed to delete comment", 500);
  }
}
