import { prisma } from "@/lib/prisma";
import { subscribersForServiceIds } from "@/lib/subscription-services";

// Analyst broadcast delivery. A broadcast is fanned out into each eligible
// subscriber's private chat with the analyst as an individual DmMessage tagged
// with broadcastId. See MESSAGES-CHANGES.md.

type Attachment = {
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
};

/** Active-subscriber user IDs for an analyst (deduped). */
export async function activeSubscriberIds(analystUserId: number): Promise<number[]> {
  const subs = await prisma.subscription.findMany({
    where: {
      advisorUserId: analystUserId,
      status: "active",
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
    select: { userId: true },
  });
  return [...new Set(subs.map((s) => s.userId))];
}

/**
 * Deliver a broadcast now: for every active subscriber, find-or-create the 1:1
 * thread and insert the broadcast message. A subscriber gets exactly one copy.
 * Returns the number of recipients delivered to.
 */
export async function deliverBroadcast(broadcastId: number): Promise<number> {
  const broadcast = await prisma.dmBroadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast || broadcast.sentAt) return broadcast?.recipientCount ?? 0;

  const analystUserId = broadcast.analystUserId;
  // Targeted broadcast → only subscribers of the chosen services; else everyone.
  const subscriberIds =
    broadcast.targetServiceIds.length > 0
      ? await subscribersForServiceIds(analystUserId, broadcast.targetServiceIds)
      : await activeSubscriberIds(analystUserId);

  let delivered = 0;
  for (const userId of subscriberIds) {
    if (userId === analystUserId) continue;

    // Find existing 1:1 thread between analyst and subscriber.
    let thread = await prisma.dmThread.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: analystUserId } } },
          { participants: { some: { userId } } },
        ],
      },
      select: { id: true },
    });
    // No conversation yet → create one.
    if (!thread) {
      thread = await prisma.dmThread.create({
        data: {
          participants: {
            create: [{ userId: analystUserId }, { userId }],
          },
        },
        select: { id: true },
      });
    }

    await prisma.dmMessage.create({
      data: {
        threadId: thread.id,
        senderUserId: analystUserId,
        contentEnc: broadcast.content,
        attachmentUrl: broadcast.attachmentUrl,
        attachmentType: broadcast.attachmentType,
        attachmentName: broadcast.attachmentName,
        broadcastId: broadcast.id,
      },
    });
    delivered++;
  }

  await prisma.dmBroadcast.update({
    where: { id: broadcast.id },
    data: { sentAt: new Date(), recipientCount: delivered },
  });
  return delivered;
}

/** Create a broadcast row (unsent). Delivery happens via deliverBroadcast. */
export async function createBroadcast(args: {
  analystUserId: number;
  content: string;
  scheduledAt?: Date | null;
  attachment?: Attachment;
  targetServiceIds?: number[];
}): Promise<{ id: number }> {
  const b = await prisma.dmBroadcast.create({
    data: {
      analystUserId: args.analystUserId,
      content: args.content,
      scheduledAt: args.scheduledAt ?? null,
      targetServiceIds: args.targetServiceIds ?? [],
      attachmentUrl: args.attachment?.attachmentUrl ?? null,
      attachmentType: args.attachment?.attachmentType ?? null,
      attachmentName: args.attachment?.attachmentName ?? null,
    },
    select: { id: true },
  });
  return b;
}

/** Send any scheduled broadcasts whose time has come (lazy, no cron). */
export async function sendDueBroadcasts(): Promise<void> {
  try {
    const due = await prisma.dmBroadcast.findMany({
      where: { sentAt: null, scheduledAt: { not: null, lte: new Date() } },
      select: { id: true },
      take: 20,
    });
    for (const b of due) {
      await deliverBroadcast(b.id);
    }
  } catch {
    // Non-fatal.
  }
}
