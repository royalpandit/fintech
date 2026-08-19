import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * Web push delivery.
 *
 * The settings screen has had a "Push" channel switch since before any push
 * code existed — it saved a preference nothing acted on. This is the sender.
 */

let configured: boolean | null = null;

/** Configure VAPID once. Returns false when keys are absent (push disabled). */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@finuer.com";

  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Send to every endpoint the user has registered. Dead subscriptions (404/410)
 * are pruned — browsers rotate endpoints, and a stale row would otherwise fail
 * on every send forever.
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  let subs;
  try {
    subs = await prisma.webPushSubscription.findMany({ where: { userId } });
  } catch {
    // Table not migrated yet — behave as if push is off.
    return 0;
  }
  if (!subs.length) return 0;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/user/notifications",
    tag: payload.tag,
  });

  let sent = 0;
  const dead: number[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(sub.id);
        else console.warn("[push] send failed (%s): %s", status, (e as Error).message);
      }
    }),
  );

  if (dead.length) {
    await prisma.webPushSubscription
      .deleteMany({ where: { id: { in: dead } } })
      .catch(() => {});
  }
  if (sent) {
    await prisma.webPushSubscription
      .updateMany({ where: { userId }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return sent;
}
