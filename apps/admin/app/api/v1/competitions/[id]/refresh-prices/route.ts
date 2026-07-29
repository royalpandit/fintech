import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { competitionTradingRepository } from "@/lib/competition-trading-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const { id } = await ctx.params;
  const competitionId = Number(id);

  await competitionTradingRepository.refreshCompetitionPrices(competitionId);
  const portfolio = await competitionTradingRepository.getPortfolio(competitionId, auth.userId);

  return NextResponse.json({ ok: true, data: { refreshed: true, portfolio } });
}
