import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  getGroupBySlug,
  canViewPosts,
  canInteract,
  canUserCreatePost,
  notifyUser,
  POST_PERMISSION_DENIED,
} from "@/lib/community";
import { serializeSocialPost, socialPostInclude } from "@/lib/social-feed-serialize";
import type { FeedPostType } from "@/lib/social-feed-types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

async function enrichPosts(userId: number | null, posts: Parameters<typeof serializeSocialPost>[0][]) {
  const ids = posts.map((p) => p.id);
  const [likes, saves, unlocks] = userId
    ? await Promise.all([
        prisma.communityReaction.findMany({
          where: { userId, postId: { in: ids }, type: "like" },
          select: { postId: true },
        }),
        prisma.communityPostSave.findMany({
          where: { userId, postId: { in: ids } },
          select: { postId: true },
        }),
        prisma.communityPostUnlock.findMany({
          where: { userId, postId: { in: ids } },
          select: { postId: true },
        }),
      ])
    : [[], [], []];
  const likedIds = new Set(likes.map((l) => l.postId));
  const savedIds = new Set(saves.map((s) => s.postId));
  const unlockedIds = new Set(unlocks.map((u) => u.postId));
  return posts.map((p) =>
    serializeSocialPost(p, { userId, likedIds, savedIds, unlockedIds }),
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(req);
    const userId = auth?.userId ?? null;
    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const canView = await canViewPosts(group, userId);
    if (!canView) return err("Join this community to view posts", 403);

    const { searchParams } = new URL(req.url);
    const cursor = Number(searchParams.get("cursor") || 0) || undefined;
    const limit = Math.min(30, Math.max(1, Number(searchParams.get("limit") || PAGE_SIZE)));
    const sort = searchParams.get("sort") ?? "latest";

    let orderBy: Record<string, unknown>[] = [{ pinnedAt: "desc" }, { createdAt: "desc" }];
    if (sort === "liked") {
      orderBy = [{ reactions: { _count: "desc" } }, { createdAt: "desc" }];
    } else if (sort === "commented") {
      orderBy = [{ comments: { _count: "desc" } }, { createdAt: "desc" }];
    } else if (sort === "trending") {
      orderBy = [{ shareCount: "desc" }, { reactions: { _count: "desc" } }];
    }

    const rows = await prisma.communityPost.findMany({
      where: { groupId: group.id, deletedAt: null },
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: socialPostInclude,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    const posts = await enrichPosts(userId, page);

    return ok({ posts, next_cursor: nextCursor });
  } catch (e) {
    console.error("[GET /communities/:slug/posts]", e);
    return err(e instanceof Error ? e.message : "Failed to load posts", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const canPost = await canInteract(group, auth.userId);
    if (!canPost) return err("You must be a member to post", 403);

    const allowed = await canUserCreatePost(group, auth.userId);
    if (!allowed) return err(POST_PERMISSION_DENIED, 403);

    const body = await parseBody<{
      title?: string;
      content?: string;
      postType?: FeedPostType;
      imageUrls?: string[];
      videoUrls?: string[];
      linkUrl?: string;
    }>(req);

    const content = (body.content ?? "").trim();
    const title = body.title?.trim();
    if (!content && !title) return err("title or content is required");

    let postType: FeedPostType = body.postType ?? "text";
    if (body.imageUrls?.length) postType = "image";
    if (body.videoUrls?.length) postType = "video";
    if (body.linkUrl) postType = "text";

    const post = await prisma.communityPost.create({
      data: {
        userId: auth.userId,
        groupId: group.id,
        content: content || title || "",
        title: title ?? null,
        postType,
        linkUrl: body.linkUrl ?? null,
        visibility: "group",
        images: body.imageUrls?.length
          ? { create: body.imageUrls.map((url, i) => ({ url, sortOrder: i })) }
          : undefined,
        videos: body.videoUrls?.length
          ? { create: body.videoUrls.map((url, i) => ({ url, sortOrder: i })) }
          : undefined,
      },
      include: socialPostInclude,
    });

    const author = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true },
    });

    const members = await prisma.groupMember.findMany({
      where: { groupId: group.id, userId: { not: auth.userId } },
      select: { userId: true },
    });
    await Promise.all(
      members.slice(0, 50).map((m) =>
        notifyUser(
          m.userId,
          `New post in ${group.name}`,
          `${author?.fullName ?? "Someone"} posted: ${title ?? content.slice(0, 80)}`,
          { type: "community_post", groupId: group.id, postId: post.id, slug: group.slug },
        ),
      ),
    );

    const serialized = serializeSocialPost(post, {
      userId: auth.userId,
      likedIds: new Set(),
      savedIds: new Set(),
      unlockedIds: new Set(),
    });

    return ok({ post: serialized });
  } catch (e) {
    console.error("[POST /communities/:slug/posts]", e);
    return err(e instanceof Error ? e.message : "Failed to create post", 500);
  }
}
