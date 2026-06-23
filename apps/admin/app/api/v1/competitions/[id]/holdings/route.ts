import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serializeHolding } from "@/lib/competition-trading";
import { competitionTradingRepository } from "@/lib/competition-trading-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const { id } = await ctx.params;
  const competitionId = Number(id);

  await competitionTradingRepository.refreshUserPortfolio(competitionId, auth.userId).catch(() => null);

  const rows = await competitionTradingRepository.listHoldings(competitionId, auth.userId);
  return NextResponse.json({ ok: true, data: rows.map(serializeHolding) });
}
