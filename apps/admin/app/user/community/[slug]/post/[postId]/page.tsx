import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import {
  canViewPosts,
  canInteract,
  getGroupBySlug,
  hasRole,
  MOD_ROLES,
} from "@/lib/community";
import { prisma } from "@/lib/prisma";
import { serializeSocialPost, socialPostInclude } from "@/lib/social-feed-serialize";
import CommunityPostDetailClient from "@/components/community/community-post-detail-client";

export const dynamic = "force-dynamic";

export default async function CommunityPostPage({
  params,
}: {
  params: { slug: string; postId: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const group = await getGroupBySlug(params.slug);
  if (!group) notFound();

  const canView = await canViewPosts(group, auth?.userId ?? null);
  if (!canView) redirect(`/user/community/${params.slug}`);

  const postId = Number(params.postId);
  const post = await prisma.communityPost.findFirst({
    where: { id: postId, groupId: group.id, deletedAt: null },
    include: socialPostInclude,
  });
  if (!post) notFound();

  const userId = auth?.userId ?? null;
  const [like, save, unlock, comments, member] = await Promise.all([
    userId
      ? prisma.communityReaction.findFirst({ where: { userId, postId, type: "like" } })
      : null,
    userId ? prisma.communityPostSave.findFirst({ where: { userId, postId } }) : null,
    userId ? prisma.communityPostUnlock.findFirst({ where: { userId, postId } }) : null,
    prisma.communityComment.findMany({
      where: { postId, parentId: null, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 30,
      include: {
        user: { select: { id: true, fullName: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 10,
          include: {
            user: { select: { id: true, fullName: true } },
            _count: { select: { replies: { where: { deletedAt: null } } } },
          },
        },
        _count: { select: { replies: { where: { deletedAt: null } } } },
      },
    }),
    userId
      ? prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId: group.id, userId } },
        })
      : null,
  ]);

  const serialized = serializeSocialPost(post, {
    userId,
    likedIds: new Set(like ? [postId] : []),
    savedIds: new Set(save ? [postId] : []),
    unlockedIds: new Set(unlock ? [postId] : []),
  });

  const threadComments = comments.map((c) => ({
    id: c.id,
    content: c.content,
    created_at: c.createdAt.toISOString(),
    user: c.user,
    parent_id: c.parentId,
    reply_count: c._count.replies,
    replies: c.replies.map((r) => ({
      id: r.id,
      content: r.content,
      created_at: r.createdAt.toISOString(),
      user: r.user,
      parent_id: r.parentId,
      reply_count: r._count.replies,
      replies: [],
    })),
  }));

  const interact = await canInteract(group, userId);
  const canModerate = hasRole(member?.role, MOD_ROLES);

  return (
    <section className="user-page-section">
      <CommunityPostDetailClient
        slug={params.slug}
        communityName={group.name}
        post={serialized}
        comments={threadComments}
        canInteract={interact}
        canModerate={canModerate}
        linkUrl={post.linkUrl}
      />
    </section>
  );
}
