import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { userAvatarSelect, resolveAvatarUrl } from "@/lib/user-avatar";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const postId = Number(params.id);
  if (!postId) return err("Invalid post id");

  // Fetch top-level comments with their first-level replies
  const comments = await prisma.marketComment.findMany({
    where: { postId, parentId: null, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      user: { select: { fullName: true, ...userAvatarSelect } },
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 10,
        include: { user: { select: { fullName: true, ...userAvatarSelect } } },
      },
      _count: { select: { replies: true } },
    },
  });

  // Collapse the two avatar sources into a single `user.avatarUrl` so the
  // client doesn't have to know an advisor's picture lives elsewhere.
  const data = comments.map((c) => ({
    ...c,
    user: { fullName: c.user.fullName, avatarUrl: resolveAvatarUrl(c.user) },
    replies: c.replies.map((r) => ({
      ...r,
      user: { fullName: r.user.fullName, avatarUrl: resolveAvatarUrl(r.user) },
    })),
  }));

  return ok({ data });
}
