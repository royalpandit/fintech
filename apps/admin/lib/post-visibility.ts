import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Market post audiences.
 *  - "public"      → visible to everyone
 *  - "subscribers" → only users with an ACTIVE subscription to the advisor
 *  - "custom"      → only the specific people the advisor picked (recipients)
 */
export type PostAudience = "public" | "subscribers" | "custom";

export function parseAudience(value: string | null | undefined): PostAudience {
  if (value === "subscribers") return "subscribers";
  if (value === "custom") return "custom";
  return "public";
}

/**
 * Prisma `where` fragment that limits market posts to the ones a given viewer is
 * allowed to see. Spread it into an existing `where`:
 *   where: { ...base, ...(await marketPostAudienceWhere(userId)) }
 */
export async function marketPostAudienceWhere(
  viewerUserId: number | null,
): Promise<Prisma.MarketPostWhereInput> {
  if (!viewerUserId) return { audience: "public" };

  const subs = await prisma.subscription.findMany({
    where: { userId: viewerUserId, status: "active" },
    select: { advisorUserId: true },
  });
  const advisorIds = subs.map((s) => s.advisorUserId);

  return {
    OR: [
      { audience: "public" },
      { advisorUserId: viewerUserId }, // an advisor always sees their own posts
      { audience: "subscribers", advisorUserId: { in: advisorIds } },
      // custom-audience posts: only if the viewer is one of the chosen recipients
      { audience: "custom", recipients: { some: { userId: viewerUserId } } },
    ],
  };
}

/** Whether a single post is visible to the viewer. */
export async function canViewMarketPost(
  post: { id: number; audience: string; advisorUserId: number },
  viewerUserId: number | null,
): Promise<boolean> {
  if (post.audience === "public") return true;
  if (!viewerUserId) return false;
  if (post.advisorUserId === viewerUserId) return true;

  if (post.audience === "subscribers") {
    const sub = await prisma.subscription.findUnique({
      where: {
        userId_advisorUserId: { userId: viewerUserId, advisorUserId: post.advisorUserId },
      },
      select: { status: true },
    });
    return sub?.status === "active";
  }

  if (post.audience === "custom") {
    const recipient = await prisma.marketPostRecipient.findUnique({
      where: { postId_userId: { postId: post.id, userId: viewerUserId } },
      select: { id: true },
    });
    return Boolean(recipient);
  }

  return false;
}
