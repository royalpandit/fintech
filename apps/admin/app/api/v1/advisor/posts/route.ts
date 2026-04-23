import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

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
  }>(req);

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

  const complianceStatus = matchedPhrase ? "flagged" : "pending";
  const complianceRiskScore = matchedPhrase ? 8.5 : 2.0;

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
      publishedAt: null,
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
        : "Rule-based pre-check passed; awaiting admin review",
      createdBy: "ai",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: matchedPhrase ? "post_submitted_flagged" : "post_submitted",
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
    post,
  });
}
