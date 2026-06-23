import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  COMPETITION_API_DOCS,
  parseCompetitionTab,
  serializeCompetition,
} from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";
import { competitionTradingRepository } from "@/lib/competition-trading-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  await competitionTradingRepository.completeExpiredCompetitions();
  const tab = parseCompetitionTab(req.nextUrl.searchParams.get("tab"));

  const filters = {
    tab: tab === "my" ? ("my" as const) : tab,
    publicOnly: true,
    userId: tab === "my" ? auth?.userId ?? null : null,
  };

  if (tab === "my" && !auth) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const rows = await competitionRepository.listCompetitions(filters);

  let joinedSet = new Set<number>();
  if (auth) {
    const joined = await Promise.all(
      rows.map((r) => competitionRepository.hasJoined(r.id, auth.userId)),
    );
    joinedSet = new Set(rows.filter((_, i) => joined[i]).map((r) => r.id));
  }

  return NextResponse.json({
    ok: true,
    data: rows.map((c) =>
      serializeCompetition(c, { joined: joinedSet.has(c.id), userId: auth?.userId }),
    ),
    meta: { tab, docs: COMPETITION_API_DOCS.user.list },
  });
}
