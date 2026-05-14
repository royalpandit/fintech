import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

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
      user: { select: { fullName: true } },
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 10,
        include: { user: { select: { fullName: true } } },
      },
      _count: { select: { replies: true } },
    },
  });

  return ok({ data: comments });
}
