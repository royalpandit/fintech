import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const postId = Number(params.id);
  const body = await parseBody<{ content?: string; parentId?: number }>(req);

  if (!body.content) return err("content is required");

  const comment = await prisma.marketComment.create({
    data: {
      postId,
      userId,
      content: body.content,
      parentId: body.parentId || null,
    },
  });

  return ok({ post_id: postId, comment });
}
