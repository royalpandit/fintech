import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

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
