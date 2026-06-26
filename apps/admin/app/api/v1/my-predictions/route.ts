import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serializeMyPredictionRow } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const rows = await competitionRepository.listMyPredictions(auth.userId);

  return NextResponse.json({
    ok: true,
    data: rows.map(serializeMyPredictionRow),
  });
}
