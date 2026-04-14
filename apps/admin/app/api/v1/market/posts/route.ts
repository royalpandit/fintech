import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = searchParams.get("asset_type");
  const sentiment = searchParams.get("sentiment");
  const symbol = searchParams.get("symbol");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

  const where: Record<string, unknown> = {
    deletedAt: null,
    complianceStatus: "approved",
  };
  if (asset) where.assetType = asset;
  if (sentiment) where.sentiment = sentiment;
  if (symbol) where.marketSymbol = { contains: symbol, mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.marketPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        advisor: {
          select: { id: true, fullName: true, uuid: true },
        },
        _count: { select: { comments: true, reactions: true } },
      },
    }),
    prisma.marketPost.count({ where }),
  ]);

  return ok({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

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

  if (!body.title || !body.content || !body.assetType || !body.sentiment || !body.riskLevel || !body.disclaimer) {
    return err("title, content, assetType, sentiment, riskLevel, disclaimer are required");
  }

  const post = await prisma.marketPost.create({
    data: {
      advisorUserId: userId,
      title: body.title,
      content: body.content,
      assetType: body.assetType as any,
      marketSymbol: body.marketSymbol,
      sentiment: body.sentiment as any,
      riskLevel: body.riskLevel as any,
      timeframe: body.timeframe,
      targetPrice: body.targetPrice,
      stopLossPrice: body.stopLossPrice,
      disclaimer: body.disclaimer,
      complianceStatus: "approved",
      publishedAt: new Date(),
    },
  });

  return ok({ id: post.id, compliance_status: post.complianceStatus, post });
}
