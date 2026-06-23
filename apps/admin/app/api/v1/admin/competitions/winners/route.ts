import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeWinner } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const competitionId = req.nextUrl.searchParams.get("competition_id");
  const id = competitionId ? Number(competitionId) : null;
  const rows = await competitionRepository.listWinners(
    id && Number.isFinite(id) ? id : null,
  );

  return NextResponse.json({
    ok: true,
    data: rows.map((w) => ({
      ...serializeWinner(w),
      competitionTitle: w.competition.title,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const competitionId = Number(body.competitionId ?? body.competition_id);

  if (body.action === "sync") {
    if (!Number.isFinite(competitionId)) {
      return NextResponse.json({ ok: false, error: "competitionId required" }, { status: 400 });
    }
    const rows = await competitionRepository.syncWinnersFromLeaderboard(competitionId);
    return NextResponse.json({
      ok: true,
      data: rows.map((w) => ({
        ...serializeWinner(w),
        competitionTitle: w.competition.title,
      })),
    });
  }

  if (body.action === "mark_distributed") {
    const winnerId = Number(body.winnerId ?? body.winner_id);
    const distributed = Boolean(body.distributed);
    const row = await competitionRepository.markWinnerDistributed(winnerId, distributed);
    return NextResponse.json({
      ok: true,
      data: {
        ...serializeWinner(row),
        competitionTitle: row.competition.title,
      },
    });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
