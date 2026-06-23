import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serializeCompetition } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireAuth(req);

  const row = await competitionRepository.findCompetitionById(Number(id));
  if (!row || row.visibility !== "public" || row.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const joined = auth ? await competitionRepository.hasJoined(row.id, auth.userId) : false;
  const data = serializeCompetition(row, { joined, userId: auth?.userId });

  return NextResponse.json({
    ok: true,
    data: {
      ...data,
      rules:
        "Participants compete based on portfolio performance during the competition period. Rankings update automatically. Prizes are distributed per the prize table after the competition ends.",
    },
  });
}
