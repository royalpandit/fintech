import { prisma } from "@/lib/prisma";
import { isMailConfigured, renderDigest, sendMail, type DigestItem } from "@/lib/mailer";

/**
 * Batched email notifications.
 *
 * Deliberately a digest rather than one email per event: an immediate mail for
 * every like or comment is indistinguishable from spam and gets senders blocked.
 * The cron tick collects each user's unread, unsent notifications and sends one
 * summary.
 *
 * "Already emailed" is tracked on the notification's own `data` payload
 * (`emailedAt`), so this needs no extra table.
 */

const LOOKBACK_HOURS = 24;
const MAX_ITEMS_PER_EMAIL = 12;

function hrefOf(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const href = (data as { href?: unknown }).href;
  return typeof href === "string" ? href : null;
}

function alreadyEmailed(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return Boolean((data as { emailedAt?: unknown }).emailedAt);
}

export async function sendNotificationDigests(): Promise<{
  users: number;
  emails: number;
  skipped?: string;
}> {
  if (!isMailConfigured()) {
    return { users: 0, emails: 0, skipped: "mail not configured" };
  }

  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const baseUrl = (process.env.NEXTAUTH_URL || "https://finuer.com").replace(/\/$/, "");

  // Unread notifications from the window, for users who haven't turned email off.
  const rows = await prisma.notification.findMany({
    where: {
      readAt: null,
      createdAt: { gte: since },
      user: {
        deletedAt: null,
        email: { not: "" },
        OR: [
          { notificationPref: null }, // no row → defaults, email on
          { notificationPref: { emailEnabled: true } },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      title: true,
      message: true,
      data: true,
      user: { select: { id: true, fullName: true, email: true } },
    },
    take: 2000,
  });

  // Group per user, dropping any we've already emailed.
  const byUser = new Map<
    number,
    { name: string; email: string; ids: number[]; items: DigestItem[] }
  >();
  for (const n of rows) {
    if (alreadyEmailed(n.data)) continue;
    if (!n.user?.email) continue;

    const bucket =
      byUser.get(n.userId) ??
      { name: n.user.fullName, email: n.user.email, ids: [], items: [] };
    if (bucket.items.length < MAX_ITEMS_PER_EMAIL) {
      bucket.items.push({ title: n.title, message: n.message, href: hrefOf(n.data) });
    }
    // Mark every one considered, even beyond the display cap, so the overflow
    // isn't re-sent tomorrow.
    bucket.ids.push(n.id);
    byUser.set(n.userId, bucket);
  }

  let emails = 0;
  for (const [, bucket] of byUser) {
    if (!bucket.items.length) continue;

    const { subject, html } = renderDigest({
      name: bucket.name,
      items: bucket.items,
      baseUrl,
    });
    const sent = await sendMail({ to: bucket.email, subject, html });
    if (!sent) continue;
    emails++;

    // Stamp emailedAt so the next tick skips these. Done per-row because the
    // marker lives inside each notification's JSON payload.
    const stampedAt = new Date().toISOString();
    await Promise.all(
      bucket.ids.map((id) =>
        prisma.notification
          .findUnique({ where: { id }, select: { data: true } })
          .then((row) => {
            const base =
              row?.data && typeof row.data === "object" && !Array.isArray(row.data)
                ? (row.data as Record<string, unknown>)
                : {};
            return prisma.notification.update({
              where: { id },
              data: { data: { ...base, emailedAt: stampedAt } as never },
            });
          })
          .catch(() => {}),
      ),
    );
  }

  return { users: byUser.size, emails };
}
