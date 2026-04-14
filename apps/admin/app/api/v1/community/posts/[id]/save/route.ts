import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const postId = Number(params.id);

  const existing = await prisma.communityPostSave.findFirst({
    where: { postId, userId },
  });

  if (existing) {
    await prisma.communityPostSave.delete({ where: { id: existing.id } });
    return ok({ saved_post_id: postId, saved: false });
  }

  await prisma.communityPostSave.create({ data: { postId, userId } });
  return ok({ saved_post_id: postId, saved: true });
}
