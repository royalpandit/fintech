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
