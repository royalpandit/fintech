import { NextResponse, type NextRequest } from "next/server";
import { serializeLeaderboardEntry } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const competitionId = Number(id);

  const competition = await competitionRepository.findCompetitionById(competitionId);
  if (!competition || competition.visibility === "hidden" || competition.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const rows = await competitionRepository.listLeaderboard(competitionId);

  return NextResponse.json({
    ok: true,
    data: rows
      .filter((r) => (Number(r.points) ?? 0) > 0 || competition.resultDeclaredAt)
      .map(serializeLeaderboardEntry),
    meta: { competitionId, title: competition.title },
  });
}
