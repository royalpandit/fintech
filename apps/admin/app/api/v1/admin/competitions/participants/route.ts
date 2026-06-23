import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeParticipant } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const params = req.nextUrl.searchParams;
  const competitionId = params.get("competition_id")
    ? Number(params.get("competition_id"))
    : null;
  const search = params.get("search");
  const page = Number(params.get("page") ?? 1);

  const [rows, total] = await competitionRepository.listParticipants({
    competitionId: competitionId && Number.isFinite(competitionId) ? competitionId : null,
    search,
    page,
    pageSize: 20,
  });

  return NextResponse.json({
    ok: true,
    data: rows.map((r) => ({
      ...serializeParticipant(r),
      competitionTitle: r.competition.title,
    })),
    meta: { total, page, pageSize: 20 },
  });
}
