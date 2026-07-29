import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serializePortfolio } from "@/lib/competition-trading";
import { competitionTradingRepository } from "@/lib/competition-trading-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const { id } = await ctx.params;
  const competitionId = Number(id);

  await competitionTradingRepository.completeExpiredCompetitions();

  try {
    await competitionTradingRepository.refreshUserPortfolio(competitionId, auth.userId);
  } catch {
    /* portfolio may not exist yet */
  }

  const portfolio = await competitionTradingRepository.getPortfolio(competitionId, auth.userId);
  if (!portfolio) {
    return NextResponse.json({ ok: false, error: "Portfolio not found — join competition first" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: serializePortfolio(portfolio) });
}
