import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { communityInclude, serializeCommunity } from "@/lib/community";
import type { CommunityType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth?.userId ?? null;
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const type = searchParams.get("type") as CommunityType | null;
    const tab = searchParams.get("tab") ?? "all";

    if (!q && tab === "all") return ok({ communities: [], posts: [], users: [] });

    const communityWhere: Record<string, unknown> = { deletedAt: null };
    if (type === "public" || type === "private") communityWhere.communityType = type;
    if (tab === "trending") {
      // no text filter
    } else if (tab === "new") {
      // no text filter
    } else if (q) {
      communityWhere.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    let communityOrder: Record<string, unknown>[] = [{ createdAt: "desc" }];
    if (tab === "trending") {
      communityOrder = [{ members: { _count: "desc" } }];
    }

    const [groups, posts, users] = await Promise.all([
      prisma.group.findMany({
        where: communityWhere,
        orderBy: communityOrder,
        take: 15,
        include: communityInclude,
      }),
      q
        ? prisma.communityPost.findMany({
            where: {
              deletedAt: null,
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 15,
            include: {
              user: { select: { id: true, fullName: true, uuid: true } },
              group: { select: { id: true, slug: true, name: true } },
            },
          })
        : [],
      q
        ? prisma.user.findMany({
            where: {
              deletedAt: null,
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { id: true, fullName: true, uuid: true, role: true },
            take: 10,
          })
        : [],
    ]);

    const communities = await Promise.all(
      groups.map((g) => serializeCommunity(g, userId)),
    );

    return ok({
      communities,
      posts: posts.map((p) => ({
        id: p.id,
        uuid: p.uuid,
        title: p.title,
        content: p.content.slice(0, 200),
        created_at: p.createdAt.toISOString(),
        user: p.user,
        community: p.group,
      })),
      users,
    });
  } catch (e) {
    console.error("[GET /communities/search]", e);
    return err(e instanceof Error ? e.message : "Search failed", 500);
  }
}
