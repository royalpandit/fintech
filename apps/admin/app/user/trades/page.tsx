import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { marketPostAudienceWhere } from "@/lib/post-visibility";
import { serializeMarketFeedPosts } from "@/lib/market-feed-serialize";
import { publishDueScheduledPosts } from "@/lib/scheduled-posts";
import TradesClient from "@/components/trades/trades-client";

export const dynamic = "force-dynamic";

// Dedicated Trades section — structured BUY/SELL calls live here; normal analysis
// posts stay in the Feed. See TRADES-PHASE1-2-CHANGES.md (Phase 3).
export default async function TradesPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  await publishDueScheduledPosts();

  const audienceWhere = await marketPostAudienceWhere(userId);

  const posts = await prisma.marketPost.findMany({
    where: {
      complianceStatus: "approved",
      deletedAt: null,
      // Drafts have publishedAt: null, so this also excludes them.
      publishedAt: { not: null },
      // Combine the "is a trade" OR with the audience OR under AND so neither
      // clobbers the other (both return an `OR` key).
      AND: [
        {
          OR: [
            { entryPriceMin: { not: null } },
            { targetPrice: { not: null } },
            { stopLossPrice: { not: null } },
          ],
        },
        audienceWhere,
      ],
    },
    orderBy: [{ boostedUntil: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
    take: 40,
    include: {
      advisor: {
        select: {
          id: true,
          fullName: true,
          advisorProfile: { select: { sebiRegistrationNo: true, profileImageUrl: true } },
        },
      },
      _count: { select: { reactions: true, comments: true } },
    },
  });

  const unlocked = userId
    ? (
        await prisma.marketPostUnlock.findMany({
          where: { userId, postId: { in: posts.map((p) => p.id) } },
          select: { postId: true },
        })
      ).map((u) => u.postId)
    : [];

  const serialized = serializeMarketFeedPosts(posts, userId, unlocked);

  return <TradesClient trades={JSON.parse(JSON.stringify(serialized))} isAuthed={isAuthed} />;
}
