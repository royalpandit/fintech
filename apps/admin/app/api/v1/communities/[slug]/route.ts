import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  communityInclude,
  serializeCommunity,
  getGroupBySlug,
  hasRole,
  ADMIN_ROLES,
  uniqueSlug,
} from "@/lib/community";
import type { CommunityType, PostPermission } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(_req);
    const userId = auth?.userId ?? null;
    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const community = await serializeCommunity(group, userId);
    return ok({ community });
  } catch (e) {
    console.error("[GET /communities/:slug]", e);
    return err(e instanceof Error ? e.message : "Failed to load community", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
    });
    if (!hasRole(member?.role, ["owner", "admin"])) {
      return err("Forbidden", 403);
    }

    const body = await parseBody<{
      name?: string;
      description?: string;
      logoUrl?: string;
      bannerUrl?: string;
      communityType?: CommunityType;
      postPermission?: PostPermission;
      rules?: string;
    }>(req);

    const data: Record<string, unknown> = {};
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;
    if (body.bannerUrl !== undefined) data.bannerUrl = body.bannerUrl || null;
    if (body.rules !== undefined) data.rules = body.rules?.trim() || null;
    if (body.postPermission === "everyone" || body.postPermission === "admins" || body.postPermission === "owner") {
      data.postPermission = body.postPermission;
    }
    if (body.communityType === "public" || body.communityType === "private") {
      if (!hasRole(member?.role, ["owner"])) return err("Only owner can change visibility", 403);
      data.communityType = body.communityType;
    }
    if (body.name?.trim()) {
      if (!hasRole(member?.role, ["owner"])) return err("Only owner can rename community", 403);
      data.name = body.name.trim();
      data.slug = await uniqueSlug(body.name.trim());
    }

    const updated = await prisma.group.update({
      where: { id: group.id },
      data,
      include: communityInclude,
    });

    const community = await serializeCommunity(updated, auth.userId);
    return ok({ community });
  } catch (e) {
    console.error("[PATCH /communities/:slug]", e);
    return err(e instanceof Error ? e.message : "Failed to update community", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
    });
    if (!hasRole(member?.role, ["owner"])) return err("Only owner can delete community", 403);

    await prisma.group.update({
      where: { id: group.id },
      data: { deletedAt: new Date() },
    });

    return ok({ deleted: true });
  } catch (e) {
    console.error("[DELETE /communities/:slug]", e);
    return err(e instanceof Error ? e.message : "Failed to delete community", 500);
  }
}
