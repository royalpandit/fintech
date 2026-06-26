import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  canUserAccessCompetition,
  serializeCompetition,
} from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  const competitionId = Number(id);

  const row = await competitionRepository.findCompetitionById(competitionId);
  if (!row || row.status === "cancelled" || row.status === "draft") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  if (row.visibility === "hidden") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  if (auth) {
    const ctxUser = await competitionRepository.getUserCompetitionContext(auth.userId, auth.role);
    if (!canUserAccessCompetition(row.visibility, ctxUser)) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
  } else if (row.visibility !== "public") {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const prediction = auth
    ? await competitionRepository.getUserPrediction(competitionId, auth.userId)
    : null;

  const data = serializeCompetition(row, {
    hasPrediction: Boolean(prediction),
    userPrediction: prediction,
    joined: Boolean(prediction),
  });

  return NextResponse.json({ ok: true, data });
}
