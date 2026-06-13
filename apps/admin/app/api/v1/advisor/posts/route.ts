import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { parsePostAccessType } from "@/lib/post-access";
import { getBoostTier } from "@/lib/post-boost";
import { parseAudience } from "@/lib/post-visibility";

export const dynamic = "force-dynamic";

const VALID_SENTIMENT = ["bullish", "bearish", "neutral"] as const;
const VALID_RISK = ["low", "medium", "high"] as const;
const VALID_ASSET = ["equity", "crypto", "mf", "commodity", "other"] as const;

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
    select: { verificationStatus: true },
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
  }>(req);

  const audience = parseAudience(body.audience);

  // For "custom" audience, keep only ids that are actually active subscribers of
  // this advisor — you can only send to people who've subscribed to you.
  let recipientIds: number[] = [];
  if (audience === "custom") {
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
      targetPrice: typeof body.targetPrice === "number" ? body.targetPrice : null,
      stopLossPrice: typeof body.stopLossPrice === "number" ? body.stopLossPrice : null,
      disclaimer,
      complianceStatus: complianceStatus as any,
      complianceRiskScore,
      postAccessType,
      unlockPrice:
        postAccessType === "paid" && typeof body.unlockPrice === "number"
          ? body.unlockPrice
          : null,
      publishedAt: matchedPhrase ? null : new Date(),
      boostedUntil,
      boostTier: willBoost && boostTierObj ? boostTierObj.id : null,
      audience,
    },
  });

  if (audience === "custom" && recipientIds.length > 0) {
    await prisma.marketPostRecipient.createMany({
      data: recipientIds.map((userId) => ({ postId: post.id, userId })),
      skipDuplicates: true,
    });
  }

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
