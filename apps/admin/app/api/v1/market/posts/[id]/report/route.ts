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
  const body = await parseBody<{ reason?: string }>(req);

  if (!body.reason) return err("reason is required");

  const report = await prisma.contentReport.create({
    data: {
      reporterUserId: userId,
      contentKind: "market_post",
      contentId: postId,
      reason: body.reason,
    },
  });

  return ok({ post_id: postId, report });
}
