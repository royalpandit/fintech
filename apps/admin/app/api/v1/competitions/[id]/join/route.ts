import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serializePrediction } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Legacy join endpoint — now submits prediction or returns existing prediction info */
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const optionId = Number(body.optionId ?? body.option_id);

  if (!Number.isFinite(optionId)) {
    const existing = await competitionRepository.getUserPrediction(Number(id), auth.userId);
    if (existing) {
      return NextResponse.json({ ok: true, data: serializePrediction(existing) });
    }
    return NextResponse.json(
      { ok: false, error: "Select an answer option to participate" },
      { status: 400 },
    );
  }

  try {
    const prediction = await competitionRepository.submitPrediction(
      Number(id),
      auth.userId,
      optionId,
      auth.role,
    );
    return NextResponse.json({ ok: true, data: serializePrediction(prediction) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to join" },
      { status: 400 },
    );
  }
}
