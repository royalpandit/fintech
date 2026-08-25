import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

/**
 * In-app notification fan-out.
 *
 * Notifications were only ever written for community posts and comment replies,
 * so neither advisors nor users heard about DMs, follows, subscriptions, likes
 * or comments. Every trigger now routes through here.
 *
 * Delivery is best-effort: a notification must never fail the action that
 * caused it (sending a message, following, subscribing…), so all errors are
 * swallowed and logged.
 */

type NotifyInput = {
  userId: number;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
};

/**
 * Which settings category each notification kind belongs to. Kinds left out —
 * verification, compliance, report — are account/system messages that a
 * category switch shouldn't be able to silence.
 */
const KIND_CATEGORY: Record<string, CategoryField> = {
  // Market sentiment alerts
  trade_status: "marketAlerts",
  price_alert: "marketAlerts",
  advisor_post: "marketAlerts",
  // Portfolio risk alerts
  paper_order: "portfolioAlerts",
  basket_rebalance: "portfolioAlerts",
  // Budget breach alerts
  budget: "budgetAlerts",
  wallet: "budgetAlerts",
  payout: "budgetAlerts",
  // Followed advisor activity
  follow: "advisorAlerts",
  subscription: "advisorAlerts",
  course: "advisorAlerts",
  competition: "advisorAlerts",
  // Comments and replies
  comment: "socialAlerts",
  like: "socialAlerts",
  message: "socialAlerts",
};

type CategoryField =
  | "marketAlerts"
  | "portfolioAlerts"
  | "budgetAlerts"
  | "socialAlerts"
  | "advisorAlerts";

/** Read the `kind` we stamp onto every notification's data payload. */
function categoryFor(data: Prisma.InputJsonValue | undefined): CategoryField | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const kind = (data as { kind?: unknown }).kind;
  return typeof kind === "string" ? KIND_CATEGORY[kind] ?? null : null;
}

/**
 * Drop users who've switched off in-app delivery, or the category this
 * notification belongs to. Both switches are honoured — previously only
 * `inAppEnabled` was, so the five category toggles saved but filtered nothing.
 */
async function filterByPreference(
  userIds: number[],
  category: CategoryField | null,
): Promise<number[]> {
  if (!userIds.length) return [];
  try {
    const prefs = await prisma.notificationPreference.findMany({
      where: {
        userId: { in: userIds },
        OR: [{ inAppEnabled: false }, ...(category ? [{ [category]: false }] : [])],
      },
      select: { userId: true },
    });
    if (!prefs.length) return userIds;
    const off = new Set(prefs.map((p) => p.userId));
    return userIds.filter((id) => !off.has(id));
  } catch {
    // Preference table missing/unmigrated — default to delivering.
    return userIds;
  }
}

/** Users who still want browser push for this category. */
async function pushRecipients(
  userIds: number[],
  category: CategoryField | null,
): Promise<number[]> {
  if (!userIds.length) return [];
  try {
    const off = await prisma.notificationPreference.findMany({
      where: {
        userId: { in: userIds },
        OR: [{ pushEnabled: false }, ...(category ? [{ [category]: false }] : [])],
      },
      select: { userId: true },
    });
    const blocked = new Set(off.map((p) => p.userId));
    return userIds.filter((id) => !blocked.has(id));
  } catch {
    return userIds;
  }
}

/** Extract the click-through target we stamp on every notification. */
function hrefOf(data: Prisma.InputJsonValue | undefined): string | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const href = (data as { href?: unknown }).href;
  return typeof href === "string" ? href : undefined;
}

function truncate(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Send one in-app notification. Never throws. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const [allowed] = await filterByPreference([input.userId], categoryFor(input.data));
    if (allowed == null) return;
    await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title.slice(0, 200),
        message: input.message,
        channel: "in_app",
        data: input.data,
      },
    });

    // Mirror to browser push for users who want it. Best-effort.
    const category = categoryFor(input.data);
    const [pushOk] = await pushRecipients([input.userId], category);
    if (pushOk != null) {
      await sendPushToUser(input.userId, {
        title: input.title,
        body: input.message,
        url: hrefOf(input.data),
        tag: category ?? undefined,
      });
    }
  } catch (e) {
    console.warn("[notify] failed for user %s: %s", input.userId, (e as Error).message);
  }
}

/** Send the same notification to many users. Never throws. */
export async function notifyMany(
  userIds: number[],
  build: (userId: number) => Omit<NotifyInput, "userId">,
): Promise<void> {
  const unique = [...new Set(userIds)].filter((id) => Number.isFinite(id));
  if (!unique.length) return;
  try {
    // Every row in a bulk send shares the same kind, so resolve the category
    // from the first one and filter the whole batch on it.
    const sample = build(unique[0]);
    const allowed = await filterByPreference(unique, categoryFor(sample.data));
    if (!allowed.length) return;
    await prisma.notification.createMany({
      data: allowed.map((userId) => {
        const n = build(userId);
        return {
          userId,
          title: n.title.slice(0, 200),
          message: n.message,
          channel: "in_app" as const,
          data: n.data,
        };
      }),
    });

    const pushTargets = await pushRecipients(allowed, categoryFor(sample.data));
    await Promise.all(
      pushTargets.map((userId) => {
        const n = build(userId);
        return sendPushToUser(userId, {
          title: n.title,
          body: n.message,
          url: hrefOf(n.data),
          tag: categoryFor(n.data) ?? undefined,
        });
      }),
    );
  } catch (e) {
    console.warn("[notify] bulk failed: %s", (e as Error).message);
  }
}

// ── Triggers ────────────────────────────────────────────────────────────────

/** A direct message was received. Fires for advisors and users alike. */
export async function notifyNewMessage(params: {
  recipientUserId: number;
  senderName: string;
  threadId: number;
  preview: string;
  isAttachment?: boolean;
}): Promise<void> {
  const body = params.isAttachment && !params.preview ? "Sent an attachment" : params.preview;
  await notify({
    userId: params.recipientUserId,
    title: `New message from ${params.senderName}`,
    message: truncate(body || "Sent you a message"),
    data: { kind: "message", threadId: params.threadId, href: `/user/messages/${params.threadId}` },
  });
}

/** Someone followed you. */
export async function notifyNewFollower(params: {
  targetUserId: number;
  followerUserId: number;
  followerName: string;
}): Promise<void> {
  await notify({
    userId: params.targetUserId,
    title: "New follower",
    message: `${params.followerName} started following you`,
    data: { kind: "follow", userId: params.followerUserId, href: `/user/advisors/${params.followerUserId}` },
  });
}

/** Someone subscribed to an advisor. */
export async function notifyNewSubscriber(params: {
  advisorUserId: number;
  subscriberName: string;
  planLabel?: string | null;
}): Promise<void> {
  await notify({
    userId: params.advisorUserId,
    title: "New subscriber",
    message: params.planLabel
      ? `${params.subscriberName} subscribed to ${params.planLabel}`
      : `${params.subscriberName} subscribed to you`,
    data: { kind: "subscription", href: "/advisor/subscribers" },
  });
}

/** Someone commented on a market post. Notifies the post's author. */
export async function notifyPostComment(params: {
  postId: number;
  authorUserId: number;
  commenterUserId: number;
  commenterName: string;
  content: string;
}): Promise<void> {
  if (params.authorUserId === params.commenterUserId) return; // don't ping yourself
  await notify({
    userId: params.authorUserId,
    title: `${params.commenterName} commented on your post`,
    message: truncate(params.content),
    data: { kind: "comment", postId: params.postId, href: `/user/markets/${params.postId}#comments` },
  });
}

/** Someone liked a market post. Notifies the post's author. */
export async function notifyPostLike(params: {
  postId: number;
  postTitle: string;
  authorUserId: number;
  likerUserId: number;
  likerName: string;
}): Promise<void> {
  if (params.authorUserId === params.likerUserId) return;
  await notify({
    userId: params.authorUserId,
    title: `${params.likerName} liked your post`,
    message: truncate(params.postTitle),
    data: { kind: "like", postId: params.postId, href: `/user/markets/${params.postId}` },
  });
}

/**
 * An advisor published a post/trade — tell their followers and active
 * subscribers. This is the main way ordinary users get notifications.
 */
export async function notifyAdvisorPost(params: {
  advisorUserId: number;
  advisorName: string;
  postId: number;
  postTitle: string;
  isTrade?: boolean;
}): Promise<void> {
  try {
    const [followers, subscribers] = await Promise.all([
      prisma.userFollow.findMany({
        where: { followingUserId: params.advisorUserId },
        select: { followerUserId: true },
      }),
      prisma.subscription.findMany({
        where: { advisorUserId: params.advisorUserId, status: "active" },
        select: { userId: true },
      }),
    ]);

    const audience = [
      ...followers.map((f) => f.followerUserId),
      ...subscribers.map((s) => s.userId),
    ].filter((id) => id !== params.advisorUserId);

    const href = params.isTrade ? `/user/markets/${params.postId}` : `/user/markets/${params.postId}`;
    await notifyMany(audience, () => ({
      title: params.isTrade
        ? `${params.advisorName} posted a new trade`
        : `${params.advisorName} posted an update`,
      message: truncate(params.postTitle),
      data: { kind: "advisor_post", postId: params.postId, href },
    }));
  } catch (e) {
    console.warn("[notify] advisor post fan-out failed: %s", (e as Error).message);
  }
}

const TRADE_STATUS_LABEL: Record<string, string> = {
  active: "is now active",
  target_hit: "hit its target 🎯",
  stop_loss_hit: "hit its stop loss",
  exited: "has been exited",
  cancelled: "was cancelled",
};

/** A trade moved status — tell everyone who could have acted on the call. */
export async function notifyTradeStatus(params: {
  postId: number;
  postTitle: string;
  symbol: string | null;
  advisorUserId: number;
  advisorName: string;
  status: string;
  returnPct?: number | null;
}): Promise<void> {
  const label = TRADE_STATUS_LABEL[params.status];
  if (!label) return; // awaiting_entry and unknown states aren't worth a ping

  const ticker = params.symbol ? `${params.symbol} ` : "";
  const ret =
    params.returnPct != null && Number.isFinite(params.returnPct)
      ? ` (${params.returnPct >= 0 ? "+" : ""}${params.returnPct.toFixed(2)}%)`
      : "";

  try {
    const [followers, subscribers, unlockers] = await Promise.all([
      prisma.userFollow.findMany({
        where: { followingUserId: params.advisorUserId },
        select: { followerUserId: true },
      }),
      prisma.subscription.findMany({
        where: { advisorUserId: params.advisorUserId, status: "active" },
        select: { userId: true },
      }),
      prisma.marketPostUnlock.findMany({
        where: { postId: params.postId },
        select: { userId: true },
      }),
    ]);
    const audience = [
      ...followers.map((f) => f.followerUserId),
      ...subscribers.map((s) => s.userId),
      ...unlockers.map((u) => u.userId),
    ].filter((id) => id !== params.advisorUserId);

    await notifyMany(audience, () => ({
      title: `${ticker}trade ${label}`,
      message: truncate(`${params.advisorName}: ${params.postTitle}${ret}`),
      data: { kind: "trade_status", postId: params.postId, href: `/user/markets/${params.postId}` },
    }));
  } catch (e) {
    console.warn("[notify] trade status fan-out failed: %s", (e as Error).message);
  }
}

/** A paper order was filled or rejected. */
export async function notifyPaperOrder(params: {
  userId: number;
  symbol: string;
  side: string;
  quantity: number;
  filled: boolean;
  price?: number | null;
  reason?: string | null;
}): Promise<void> {
  const side = params.side.toUpperCase();
  await notify({
    userId: params.userId,
    title: params.filled
      ? `${side} ${params.quantity} ${params.symbol} filled`
      : `${side} ${params.symbol} order rejected`,
    message: params.filled
      ? `Executed at ₹${Number(params.price ?? 0).toLocaleString("en-IN")}`
      : params.reason || "The order could not be executed.",
    data: { kind: "paper_order", href: "/user/portfolio" },
  });
}

/** A price alert the user set has been reached. */
export async function notifyPriceAlert(params: {
  userId: number;
  symbol: string;
  targetPrice: number;
  direction: string;
  lastPrice: number;
}): Promise<void> {
  const dir = params.direction === "above" ? "rose above" : "fell below";
  await notify({
    userId: params.userId,
    title: `${params.symbol} ${dir} ₹${params.targetPrice.toLocaleString("en-IN")}`,
    message: `Trading at ₹${params.lastPrice.toLocaleString("en-IN")} now.`,
    data: {
      kind: "price_alert",
      href: `/user/markets/chart?symbol=${encodeURIComponent(params.symbol)}`,
    },
  });
}

/** An advisor's verification was approved or rejected. */
export async function notifyVerificationDecision(params: {
  advisorUserId: number;
  approved: boolean;
  note?: string | null;
}): Promise<void> {
  await notify({
    userId: params.advisorUserId,
    title: params.approved ? "Your profile is verified" : "Verification needs attention",
    message: params.approved
      ? "You're approved — your profile is now live and you can start posting."
      : params.note || "Your verification was not approved. Please review your details and resubmit.",
    data: { kind: "verification", href: "/advisor/profile" },
  });
}

/** A post was held back by the compliance scan. */
export async function notifyPostFlagged(params: {
  advisorUserId: number;
  postId: number;
  postTitle: string;
  reason?: string | null;
}): Promise<void> {
  await notify({
    userId: params.advisorUserId,
    title: "Post held for compliance review",
    message: truncate(
      params.reason
        ? `"${params.postTitle}" — ${params.reason}`
        : `"${params.postTitle}" is awaiting review before it goes live.`,
    ),
    data: { kind: "compliance", postId: params.postId, href: `/advisor/posts/${params.postId}` },
  });
}

/**
 * A moderator approved, flagged or rejected a post. Deliberately un-gated by
 * category — an advisor shouldn't be able to mute the outcome of a review.
 */
export async function notifyPostModeration(params: {
  advisorUserId: number;
  postId: number;
  postTitle: string;
  status: string;
  notes?: string | null;
}): Promise<void> {
  const TITLES: Record<string, string> = {
    approved: "Your post is live",
    flagged: "Your post was flagged for review",
    rejected: "Your post was rejected",
  };
  const title = TITLES[params.status];
  if (!title) return;

  const fallback: Record<string, string> = {
    approved: `"${params.postTitle}" passed review and is now visible to your followers.`,
    flagged: `"${params.postTitle}" is being reviewed and isn't visible right now.`,
    rejected: `"${params.postTitle}" was not approved.`,
  };

  await notify({
    userId: params.advisorUserId,
    title,
    message: truncate(params.notes || fallback[params.status]),
    data: {
      kind: "moderation",
      postId: params.postId,
      href: `/advisor/posts/${params.postId}`,
    },
  });
}

/** Confirm to the advisor that a post is queued for review. */
export async function notifyPostQueued(params: {
  advisorUserId: number;
  postId: number;
  postTitle: string;
}): Promise<void> {
  await notify({
    userId: params.advisorUserId,
    title: "Post submitted for review",
    message: truncate(
      `"${params.postTitle}" is pending approval and will go live once a moderator reviews it.`,
    ),
    data: {
      kind: "moderation",
      postId: params.postId,
      href: `/advisor/posts/${params.postId}`,
    },
  });
}

/** A payout request changed state. */
export async function notifyPayoutStatus(params: {
  advisorUserId: number;
  amount: number;
  status: string;
}): Promise<void> {
  // Keys match the PayoutStatus enum.
  const TITLES: Record<string, string> = {
    processing: "Payout is being processed",
    paid: "Payout sent",
    rejected: "Payout rejected",
  };
  const title = TITLES[params.status];
  if (!title) return;
  await notify({
    userId: params.advisorUserId,
    title,
    message: `₹${Number(params.amount).toLocaleString("en-IN")} — ${params.status}.`,
    data: { kind: "payout", href: "/advisor/earnings" },
  });
}

/** A subscription is about to lapse, or already has. */
export async function notifySubscriptionLifecycle(params: {
  userId: number;
  advisorName: string;
  daysLeft: number | null;
}): Promise<void> {
  const lapsed = params.daysLeft == null || params.daysLeft <= 0;
  const plural = params.daysLeft === 1 ? "" : "s";
  await notify({
    userId: params.userId,
    title: lapsed ? `Your ${params.advisorName} subscription ended` : "Subscription expiring soon",
    message: lapsed
      ? "Renew to keep access to their premium calls and chat."
      : `Your ${params.advisorName} subscription ends in ${params.daysLeft} day${plural}.`,
    data: { kind: "subscription", href: "/user/subscriptions" },
  });
}

/**
 * Finuer Pro expiry — advance warning and lapse notice.
 *
 * Deliberately left out of KIND_CATEGORY: this is a billing/account message, so
 * a category toggle shouldn't be able to silence it.
 */
export async function notifyFinuerProLifecycle(params: {
  userId: number;
  planLabel: string;
  /** null once it has actually lapsed. */
  daysLeft: number | null;
  /** Precomputed so the sweep's dedupe key and the sent title can't drift. */
  title: string;
}): Promise<void> {
  const lapsed = params.daysLeft == null || params.daysLeft <= 0;
  const plural = params.daysLeft === 1 ? "" : "s";
  await notify({
    userId: params.userId,
    title: params.title,
    message: lapsed
      ? `${params.planLabel} has ended. Premium Finuer Baskets and Pro-only competitions are locked until you renew.`
      : `${params.planLabel} ends in ${params.daysLeft} day${plural}. Renew to keep premium baskets unlocked — renewing extends from your current end date.`,
    data: { kind: "finuer_pro", href: "/user/subscriptions#finuer-pro" },
  });
}

/** Competition lifecycle — joined, results, winner. */
export async function notifyCompetition(params: {
  userId: number;
  competitionId: number;
  title: string;
  message: string;
}): Promise<void> {
  await notify({
    userId: params.userId,
    title: params.title,
    message: truncate(params.message),
    data: {
      kind: "competition",
      competitionId: params.competitionId,
      href: `/user/competition/${params.competitionId}`,
    },
  });
}

/** A course gained a lesson, or an enrolment landed. */
export async function notifyCourse(params: {
  userId: number;
  courseId: number;
  title: string;
  message: string;
}): Promise<void> {
  await notify({
    userId: params.userId,
    title: params.title,
    message: truncate(params.message),
    data: { kind: "course", courseId: params.courseId, href: `/user/courses/${params.courseId}` },
  });
}

/** A saved Finuer Basket was rebalanced. */
export async function notifyBasketRebalance(params: {
  basketId: number;
  basketName: string;
  summary: string;
}): Promise<void> {
  try {
    const savers = await prisma.finuerBasketSave.findMany({
      where: { basketId: params.basketId },
      select: { userId: true },
    });
    await notifyMany(
      savers.map((s) => s.userId),
      () => ({
        title: `${params.basketName} was rebalanced`,
        message: truncate(params.summary),
        data: {
          kind: "basket_rebalance",
          basketId: params.basketId,
          href: `/user/finuer-basket/${params.basketId}`,
        },
      }),
    );
  } catch (e) {
    console.warn("[notify] basket rebalance fan-out failed: %s", (e as Error).message);
  }
}

/** Money moved in or out of the user's wallet. */
export async function notifyWalletTransaction(params: {
  userId: number;
  amount: number;
  direction: "credit" | "debit";
  reason: string;
}): Promise<void> {
  const amt = `₹${Math.abs(Number(params.amount)).toLocaleString("en-IN")}`;
  await notify({
    userId: params.userId,
    title: params.direction === "credit" ? `${amt} added to your wallet` : `${amt} debited`,
    message: truncate(params.reason),
    data: { kind: "wallet", href: "/user/wallet" },
  });
}

/** A report the user filed has been actioned. */
export async function notifyReportResolved(params: {
  userId: number;
  outcome: string;
}): Promise<void> {
  await notify({
    userId: params.userId,
    title: "Your report was reviewed",
    message: truncate(params.outcome),
    data: { kind: "report", href: "/user/notifications" },
  });
}
