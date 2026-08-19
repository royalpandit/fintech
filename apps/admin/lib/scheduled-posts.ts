import { prisma } from "@/lib/prisma";
import { notifyAdvisorPost } from "@/lib/notify";

export async function publishDueScheduledPosts(): Promise<void> {
  try {
    // Grab the due posts first so we know who to notify — updateMany doesn't
    // return rows, and a scheduled post going live should reach followers just
    // like an immediately-published one does.
    const due = await prisma.marketPost.findMany({
      where: {
        scheduledAt: { lte: new Date() },
        publishedAt: null,
        complianceStatus: "approved",
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        advisorUserId: true,
        entryPriceMin: true,
        targetPrice: true,
        stopLossPrice: true,
        advisor: { select: { fullName: true } },
      },
    });

    if (!due.length) return;

    await prisma.marketPost.updateMany({
      where: { id: { in: due.map((p) => p.id) } },
      data: { publishedAt: new Date() },
    });

    for (const post of due) {
      await notifyAdvisorPost({
        advisorUserId: post.advisorUserId,
        advisorName: post.advisor?.fullName ?? "An advisor you follow",
        postId: post.id,
        postTitle: post.title,
        isTrade:
          post.entryPriceMin != null || post.targetPrice != null || post.stopLossPrice != null,
      });
    }
  } catch {
    // Non-fatal — never block the feed on a sweep failure.
  }
}
