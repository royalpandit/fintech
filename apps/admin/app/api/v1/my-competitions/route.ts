import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseCompetitionTab, serializeMyPredictionRow } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const tab = parseCompetitionTab(req.nextUrl.searchParams.get("tab"));

  const rows = await competitionRepository.listMyPredictions(auth.userId);

  const filtered = rows.filter(({ competition: c }) => {
    if (tab === "my") return true;
    const effective =
      c.status === "cancelled"
        ? "cancelled"
        : c.resultDeclaredAt || c.endDate < new Date()
          ? "completed"
          : c.startDate > new Date()
            ? "upcoming"
            : "live";
    if (tab === "live") return effective === "live";
    if (tab === "upcoming") return effective === "upcoming";
    if (tab === "completed") return effective === "completed";
    return true;
  });

  return NextResponse.json({
    ok: true,
    data: filtered.map(serializeMyPredictionRow),
    meta: { tab },
  });
}
