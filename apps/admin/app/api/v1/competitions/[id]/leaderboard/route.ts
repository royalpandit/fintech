import { NextResponse, type NextRequest } from "next/server";
import { serializeLeaderboardEntry } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const competitionId = Number(id);

  const competition = await competitionRepository.findCompetitionById(competitionId);
  if (!competition || competition.visibility !== "public" || competition.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const sortBy = (req.nextUrl.searchParams.get("sort_by") as "rank" | "points" | "score") || "rank";
  const rows = await competitionRepository.listLeaderboard(competitionId, sortBy);

  return NextResponse.json({
    ok: true,
    data: rows.map(serializeLeaderboardEntry),
    meta: { competitionId, title: competition.title },
  });
}
