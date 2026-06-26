import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  COMPETITION_API_DOCS,
  parseCompetitionTab,
  serializeCompetition,
} from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
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

  const enriched = await Promise.all(
    rows.map(async (c) => {
      const prediction = auth
        ? await competitionRepository.getUserPrediction(c.id, auth.userId)
        : null;
      return serializeCompetition(c, {
        hasPrediction: Boolean(prediction),
        userPrediction: prediction,
        joined: Boolean(prediction),
      });
    }),
  );

  return NextResponse.json({
    ok: true,
    data: enriched,
    meta: { tab, docs: COMPETITION_API_DOCS.user.list },
  });
}
