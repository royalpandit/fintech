import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Alias route: POST comment (same as POST /comments) */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const postId = Number(params.id);
  const body = await parseBody<{ content?: string; parentId?: number }>(req);
  const content = body.content?.trim();
  if (!content) return err("content is required");

  const post = await prisma.communityPost.findFirst({
    where: { id: postId, deletedAt: null },
  });
  if (!post) return err("Post not found", 404);

  const comment = await prisma.communityComment.create({
    data: {
      postId,
      userId: auth.userId,
      content,
      parentId: body.parentId,
    },
    include: { user: { select: { fullName: true } } },
  });

  return ok({
    comment: {
      id: comment.id,
      content: comment.content,
      created_at: comment.createdAt.toISOString(),
      user: comment.user,
      replies: [],
    },
  });
}
