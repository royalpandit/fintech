import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Number(searchParams.get("limit")) || 20);
  const category = searchParams.get("category");

  const where: Record<string, unknown> = { deletedAt: null };
  if (category) where.category = category;

  const [data, total] = await Promise.all([
    prisma.communityPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, uuid: true } },
        _count: { select: { comments: true, saves: true } },
      },
    }),
    prisma.communityPost.count({ where }),
  ]);

  return ok({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const body = await parseBody<{
    content?: string;
    mediaUrl?: string;
    category?: string;
  }>(req);

  if (!body.content) return err("content is required");

  const post = await prisma.communityPost.create({
    data: {
      userId,
      content: body.content,
      mediaUrl: body.mediaUrl,
      category: body.category || "general",
    },
  });

  return ok({ id: post.id, post });
}
