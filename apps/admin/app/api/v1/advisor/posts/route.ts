import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { parsePostAccessType } from "@/lib/post-access";
import { getBoostTier } from "@/lib/post-boost";
import { parseAudience } from "@/lib/post-visibility";
import { isTradeTimeframe, formatPrice, formatEntryRange } from "@/lib/trades";
import { subscribersForServiceIds } from "@/lib/subscription-services";
import { canType } from "@/lib/capabilities-server";

export const dynamic = "force-dynamic";

// Per "Roles and permissions in finuer": cap how many buy/sell (Entry/Target/SL)
// calls a single analyst can publish per day. Trade-posting itself is limited to
// SEBI tiers via the capability layer.
const DAILY_TRADE_POST_LIMIT = 5;

const VALID_SENTIMENT = ["bullish", "bearish", "neutral"] as const;
const VALID_RISK = ["low", "medium", "high"] as const;
const VALID_ASSET = [
  "equity",
  "crypto",
  "mf",
  "commodity",
  "other",
  "futures",
  "options",
  "currency",
] as const;
const VALID_ENTRY_TYPE = ["market", "exact", "range"] as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

  const where: Record<string, unknown> = {
    advisorUserId: auth.userId,
    deletedAt: null,
  };
  if (status && ["pending", "under_review", "approved", "flagged", "rejected"].includes(status)) {
    where.complianceStatus = status;
  }

  const [data, total] = await Promise.all([
    prisma.marketPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { comments: true, reactions: true } },
      },
    }),
    prisma.marketPost.count({ where }),
  ]);

  return ok({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  // Only approved advisors can publish.
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: auth.userId },
    select: { verificationStatus: true, professionalType: true },
  });
  if (profile?.verificationStatus !== "approved") {
    return err("Your advisor account must be approved before posting", 403);
  }

  const body = await parseBody<{
    title?: string;
    content?: string;
    assetType?: string;
    marketSymbol?: string;
    sentiment?: string;
    riskLevel?: string;
    timeframe?: string;
    targetPrice?: number;
    stopLossPrice?: number;
    disclaimer?: string;
    postAccessType?: string;
    unlockPrice?: number;
    boostTier?: string;
    audience?: string;
    recipientUserIds?: number[];
    scheduledAt?: string;
    // ── Trades Phase 1/2 ──
    exchange?: string;
    entryPriceMin?: number;
    entryPriceMax?: number;
    entryType?: string;
    timeframeType?: string;
    conviction?: number;
    imageUrls?: string[];
    saveDraft?: boolean;
    serviceIds?: number[]; // publish to these subscription services only
  }>(req);

  const entryType = VALID_ENTRY_TYPE.includes(body.entryType as never)
    ? (body.entryType as (typeof VALID_ENTRY_TYPE)[number])
    : null;
  const saveDraft = body.saveDraft === true;

  // Trades Phase 1/2 — optional trade metadata.
  const timeframeType = isTradeTimeframe(body.timeframeType) ? body.timeframeType : null;
  const entryPriceMin =
    typeof body.entryPriceMin === "number" && body.entryPriceMin > 0 ? body.entryPriceMin : null;
  const entryPriceMax =
    typeof body.entryPriceMax === "number" && body.entryPriceMax > 0 ? body.entryPriceMax : null;
  const conviction =
    typeof body.conviction === "number" && body.conviction >= 1 && body.conviction <= 5
      ? Math.round(body.conviction)
      : null;
  const targetPrice = typeof body.targetPrice === "number" && body.targetPrice > 0 ? body.targetPrice : null;
  const stopLossPrice =
    typeof body.stopLossPrice === "number" && body.stopLossPrice > 0 ? body.stopLossPrice : null;

  // A "trade" (advisory buy/sell call) is any post carrying an entry range,
  // target, or stop-loss. Per the roles matrix, only SEBI tiers may post these.
  const isTradePost =
    entryPriceMin != null || entryPriceMax != null || targetPrice != null || stopLossPrice != null;

  if (isTradePost && !(await canType(profile?.professionalType ?? null, "post.entry_target_sl"))) {
    return err(
      "Only SEBI-registered Research Analysts and Advisory Firms can post Entry/Target/SL (buy-sell) calls. You can still publish normal analysis posts.",
      403,
    );
  }

  // Daily buy/sell cap — applies to published (non-draft) trade posts only.
  if (isTradePost && body.saveDraft !== true) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayTradeCount = await prisma.marketPost.count({
      where: {
        advisorUserId: auth.userId,
        deletedAt: null,
        publishedAt: { gte: startOfDay },
        OR: [
          { entryPriceMin: { not: null } },
          { entryPriceMax: { not: null } },
          { targetPrice: { not: null } },
          { stopLossPrice: { not: null } },
        ],
      },
    });
    if (todayTradeCount >= DAILY_TRADE_POST_LIMIT) {
      return err(
        `Daily limit reached — you can publish up to ${DAILY_TRADE_POST_LIMIT} buy/sell calls per day.`,
        429,
      );
    }
  }

  const chartImages = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u) => typeof u === "string" && u.trim()).slice(0, 6)
    : [];

  // Optional scheduled publish time. Only honoured if it's a valid future date.
  let scheduledAt: Date | null = null;
  if (body.scheduledAt) {
    const d = new Date(body.scheduledAt);
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
      scheduledAt = d;
    }
  }

  let audience = parseAudience(body.audience);

  const serviceIds = Array.isArray(body.serviceIds)
    ? body.serviceIds.filter((n) => Number.isInteger(n))
    : [];

  // Publish-to-service: expand the chosen services to their subscribers and treat
  // the post as a custom-audience post targeted at exactly those users.
  let recipientIds: number[] = [];
  if (serviceIds.length > 0) {
    audience = "custom";
    recipientIds = await subscribersForServiceIds(auth.userId, serviceIds);
    if (recipientIds.length === 0) {
      return err("No subscribers own the selected service(s)");
    }
  } else if (audience === "custom") {
    // For a hand-picked custom audience, keep only active subscribers of this advisor.
    const requested = Array.isArray(body.recipientUserIds)
      ? body.recipientUserIds.filter((n) => Number.isInteger(n))
      : [];
    if (requested.length === 0) return err("Pick at least one person to send this post to");
    const validSubs = await prisma.subscription.findMany({
      where: { advisorUserId: auth.userId, status: "active", userId: { in: requested } },
      select: { userId: true },
    });
    recipientIds = validSubs.map((s) => s.userId);
    if (recipientIds.length === 0) {
      return err("The selected people are not active subscribers");
    }
  }

  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  const disclaimer = (body.disclaimer ?? "").trim();
  const assetType = body.assetType;
  const sentiment = body.sentiment;
  const riskLevel = body.riskLevel;

  if (!title || title.length < 5) return err("Title must be at least 5 characters");
  if (!content || content.length < 20) return err("Content must be at least 20 characters");
  if (!disclaimer || disclaimer.length < 20) {
    return err("Disclaimer is required (minimum 20 characters) — regulatory requirement");
  }
  if (!assetType || !VALID_ASSET.includes(assetType as any)) return err("Invalid asset type");
  if (!sentiment || !VALID_SENTIMENT.includes(sentiment as any)) return err("Invalid sentiment");
  if (!riskLevel || !VALID_RISK.includes(riskLevel as any)) return err("Invalid risk level");

  const postAccessType = parsePostAccessType(body.postAccessType) ?? "free";
  if (body.postAccessType != null && !parsePostAccessType(body.postAccessType)) {
    return err("postAccessType must be 'free' or 'paid'");
  }

  // Basic rule-based compliance pre-check. Real pipeline should be richer.
  const lowerContent = (title + " " + content).toLowerCase();
  const forbiddenPhrases = [
    "guaranteed return",
    "100% profit",
    "risk-free",
    "no risk",
    "insider tip",
    "sure shot",
    "multibagger guaranteed",
  ];
  const matchedPhrase = forbiddenPhrases.find((p) => lowerContent.includes(p));

  // Verified advisors with clean rule-pass content are auto-approved and published
  // immediately. Flagged content goes to the admin queue. Admins can demote any
  // approved post later via the moderation route.
  const complianceStatus = matchedPhrase ? "flagged" : "approved";
  const complianceRiskScore = matchedPhrase ? 8.5 : 2.0;

  // Optional boost chosen at create time. Only activates for auto-approved posts
  // (a flagged post can't be promoted). No payment is processed.
  const boostTierObj = getBoostTier(body.boostTier);
  const willBoost = Boolean(boostTierObj) && complianceStatus === "approved";
  const boostedUntil =
    willBoost && boostTierObj
      ? new Date(Date.now() + boostTierObj.days * 24 * 60 * 60 * 1000)
      : null;

  const post = await prisma.marketPost.create({
    data: {
      advisorUserId: auth.userId,
      title,
      content,
      assetType: assetType as any,
      marketSymbol: body.marketSymbol?.trim() || null,
      sentiment: sentiment as any,
      riskLevel: riskLevel as any,
      timeframe: body.timeframe?.trim() || null,
      timeframeType,
      exchange: body.exchange?.trim().toUpperCase() || null,
      entryType,
      entryPriceMin,
      entryPriceMax,
      conviction,
      // Draft trades stay in tradeStatus 'draft' and are only visible to the author.
      tradeStatus: saveDraft ? "draft" : "awaiting_entry",
      targetPrice,
      stopLossPrice,
      disclaimer,
      complianceStatus: saveDraft ? "pending" : (complianceStatus as any),
      complianceRiskScore: saveDraft ? null : complianceRiskScore,
      postAccessType,
      unlockPrice:
        postAccessType === "paid" && typeof body.unlockPrice === "number"
          ? body.unlockPrice
          : null,
      // Draft → unpublished. Flagged → unpublished (awaits review). Scheduled →
      // unpublished until due. Otherwise publish now.
      publishedAt: saveDraft || matchedPhrase || scheduledAt ? null : new Date(),
      scheduledAt: saveDraft || matchedPhrase ? null : scheduledAt,
      boostedUntil: saveDraft ? null : boostedUntil,
      boostTier: !saveDraft && willBoost && boostTierObj ? boostTierObj.id : null,
      audience,
    },
  });

  if (audience === "custom" && recipientIds.length > 0) {
    await prisma.marketPostRecipient.createMany({
      data: recipientIds.map((userId) => ({ postId: post.id, userId })),
      skipDuplicates: true,
    });
  }

  // ── Trades Phase 1/2 ──────────────────────────────────────────────────
  if (chartImages.length > 0) {
    await prisma.marketPostImage.createMany({
      data: chartImages.map((url, i) => ({ postId: post.id, url, sortOrder: i })),
    });
  }

  // Seed the timeline with the "Trade Published" event (not for drafts).
  if (!saveDraft) {
  const entryText = formatEntryRange(entryPriceMin, entryPriceMax);
  const slText = post.stopLossPrice ? formatPrice(Number(post.stopLossPrice)) : "—";
  const targetText = post.targetPrice ? formatPrice(Number(post.targetPrice)) : "—";
  await prisma.marketPostUpdate.create({
    data: {
      postId: post.id,
      kind: "published",
      title: "Trade Published",
      note:
        entryText !== "—"
          ? `Entry ${entryText} · SL ${slText} · Target ${targetText}`
          : `SL ${slText} · Target ${targetText}`,
    },
  });

  await prisma.complianceLog.create({
    data: {
      module: "market_post",
      referenceId: post.id,
      status: complianceStatus as any,
      riskScore: complianceRiskScore,
      notes: matchedPhrase
        ? `Rule-based flag: contains forbidden phrase "${matchedPhrase}"`
        : "Rule-based pre-check passed; auto-approved",
      createdBy: "ai",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: matchedPhrase ? "post_submitted_flagged" : "post_published",
      module: "market_posts",
      targetKind: "market_post",
      targetId: post.id,
    },
  });
  }
  // ──────────────────────────────────────────────────────────────────────

  return ok({
    id: post.id,
    complianceStatus: post.complianceStatus,
    complianceRiskScore: post.complianceRiskScore,
    flagged: Boolean(matchedPhrase),
    matchedPhrase: matchedPhrase ?? null,
    boosted: willBoost,
    post,
  });
}
