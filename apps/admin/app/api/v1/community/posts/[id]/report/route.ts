import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const postId = Number(params.id);
  const body = await parseBody<{ reason?: string }>(req);
  if (!body.reason?.trim()) return err("reason is required");

  const post = await prisma.communityPost.findFirst({
    where: { id: postId, deletedAt: null },
  });
  if (!post) return err("Post not found", 404);

  await prisma.contentReport.create({
    data: {
      reporterUserId: auth.userId,
      contentKind: "community_post",
      contentId: postId,
      reason: body.reason.trim(),
    },
  });

  return ok({ reported: true });
}
