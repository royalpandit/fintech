import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Returns comments on the advisor's own posts, for moderation.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Number(searchParams.get("limit")) || 50);

  const where: Record<string, unknown> = {
    deletedAt: null,
    post: { advisorUserId: auth.userId, deletedAt: null },
  };

  if (filter === "toxic") {
    where.toxicityScore = { gte: 5 };
  } else if (filter === "flagged") {
    where.toxicityScore = { gte: 7 };
  }

  const [comments, total, totalCount, toxicCount] = await Promise.all([
    prisma.marketComment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        post: { select: { id: true, title: true } },
      },
    }),
    prisma.marketComment.count({ where }),
    prisma.marketComment.count({
      where: { deletedAt: null, post: { advisorUserId: auth.userId, deletedAt: null } },
    }),
    prisma.marketComment.count({
      where: {
        deletedAt: null,
        post: { advisorUserId: auth.userId, deletedAt: null },
        toxicityScore: { gte: 5 },
      },
    }),
  ]);

  return ok({
    data: comments,
    total,
    totalCount,
    toxicCount,
    page,
    limit,
  });
}
