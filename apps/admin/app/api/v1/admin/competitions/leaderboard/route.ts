import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeLeaderboardEntry } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const competitionId = Number(req.nextUrl.searchParams.get("competition_id"));
  if (!Number.isFinite(competitionId)) {
    return NextResponse.json({ ok: false, error: "competition_id is required" }, { status: 400 });
  }

  const sortBy = (req.nextUrl.searchParams.get("sort_by") as "rank" | "points" | "score") || "rank";
  const rows = await competitionRepository.listLeaderboard(competitionId, sortBy);

  return NextResponse.json({
    ok: true,
    data: rows.map(serializeLeaderboardEntry),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const competitionId = Number(body.competitionId ?? body.competition_id);
  const userId = Number(body.userId ?? body.user_id);
  const points = body.points != null ? Number(body.points) : undefined;
  const score = body.score != null ? Number(body.score) : undefined;

  if (!Number.isFinite(competitionId) || !Number.isFinite(userId)) {
    return NextResponse.json({ ok: false, error: "competitionId and userId required" }, { status: 400 });
  }

  if (body.action === "recalculate") {
    const rows = await competitionRepository.recalculateRanks(competitionId);
    return NextResponse.json({ ok: true, data: rows.map(serializeLeaderboardEntry) });
  }

  const entry = await competitionRepository.upsertLeaderboardEntry(competitionId, userId, {
    points,
    score,
  });
  await competitionRepository.recalculateRanks(competitionId);
  const rows = await competitionRepository.listLeaderboard(competitionId);

  return NextResponse.json({
    ok: true,
    data: rows.map(serializeLeaderboardEntry),
    updated: serializeLeaderboardEntry(entry),
  });
}
