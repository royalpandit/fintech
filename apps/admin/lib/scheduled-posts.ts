import { prisma } from "@/lib/prisma";

// There's no background scheduler, so scheduled posts are published lazily: any
// approved post whose scheduled_at has passed but isn't published yet gets
// published the next time the feed is read. Cheap and good enough at this scale.
export async function publishDueScheduledPosts(): Promise<void> {
  try {
    await prisma.marketPost.updateMany({
      where: {
        scheduledAt: { lte: new Date() },
        publishedAt: null,
        complianceStatus: "approved",
        deletedAt: null,
      },
      data: { publishedAt: new Date() },
    });
  } catch {
    // Non-fatal — never block the feed on a sweep failure.
  }
}
