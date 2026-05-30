import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  communityInclude,
  serializeCommunity,
  uniqueSlug,
  notifyGroupAdmins,
} from "@/lib/community";
import type { CommunityType } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth?.userId ?? null;
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") ?? "home";
    const sort = searchParams.get("sort") ?? "latest";
    const type = searchParams.get("type") as CommunityType | null;
    const q = searchParams.get("q")?.trim();
    const cursor = Number(searchParams.get("cursor") || 0) || undefined;
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || PAGE_SIZE)));

    const where: Record<string, unknown> = { deletedAt: null };
    if (type === "public" || type === "private") where.communityType = type;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    if (tab === "joined" && userId) {
      where.members = { some: { userId } };
    } else if (tab === "mine" && userId) {
      where.createdBy = userId;
    } else if (tab === "popular") {
      // handled via orderBy member count
    }

    let orderBy: Record<string, unknown>[] = [{ createdAt: "desc" }];
    if (sort === "trending" || tab === "popular") {
      orderBy = [{ members: { _count: "desc" } }, { createdAt: "desc" }];
    } else if (sort === "new") {
      orderBy = [{ createdAt: "desc" }];
    }

    const rows = await prisma.group.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: communityInclude,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    const communities = await Promise.all(
      page.map((g) => serializeCommunity(g, userId)),
    );

    return ok({ communities, next_cursor: nextCursor });
  } catch (e) {
    console.error("[GET /communities]", e);
    return err(e instanceof Error ? e.message : "Failed to load communities", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const body = await parseBody<{
      name?: string;
      description?: string;
      logoUrl?: string;
      bannerUrl?: string;
      communityType?: CommunityType;
      rules?: string;
    }>(req);

    const name = body.name?.trim();
    if (!name || name.length < 3) return err("Community name must be at least 3 characters");

    const communityType = body.communityType === "private" ? "private" : "public";
    const slug = await uniqueSlug(name);

    const group = await prisma.group.create({
      data: {
        name,
        slug,
        description: body.description?.trim() || null,
        logoUrl: body.logoUrl || null,
        bannerUrl: body.bannerUrl || null,
        communityType,
        rules: body.rules?.trim() || null,
        createdBy: auth.userId,
        members: {
          create: { userId: auth.userId, role: "owner" },
        },
      },
      include: communityInclude,
    });

    const community = await serializeCommunity(group, auth.userId);
    return ok({ community });
  } catch (e) {
    console.error("[POST /communities]", e);
    return err(e instanceof Error ? e.message : "Failed to create community", 500);
  }
}
