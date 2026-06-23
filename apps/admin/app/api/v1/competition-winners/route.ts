import { NextResponse, type NextRequest } from "next/server";
import { serializeWinner } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const competitionId = req.nextUrl.searchParams.get("competition_id");
  const id = competitionId ? Number(competitionId) : null;

  const rows = await competitionRepository.listWinnersWithReturns(
    id && Number.isFinite(id) ? id : null,
  );

  const publicRows = rows.filter((r) => r.winner.competition.visibility === "public");

  return NextResponse.json({
    ok: true,
    data: publicRows.map((r) => ({
      ...serializeWinner(r.winner),
      totalReturn: r.totalReturn,
      portfolioValue: r.portfolioValue,
      competitionTitle: r.winner.competition.title,
    })),
  });
}
