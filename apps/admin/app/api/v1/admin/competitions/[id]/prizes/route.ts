import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { normalizePrizeInput, serializePrize } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const prizes = await competitionRepository.listPrizes(Number(id));
  return NextResponse.json({ ok: true, data: prizes.map(serializePrize) });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const prizes = Array.isArray(body.prizes)
    ? body.prizes.map(normalizePrizeInput).filter((p): p is NonNullable<typeof p> => p != null)
    : [];

  for (const p of prizes) {
    if (p.fromRank > p.toRank) {
      return NextResponse.json({ ok: false, error: "fromRank must be <= toRank" }, { status: 400 });
    }
  }

  const rows = await competitionRepository.replacePrizes(Number(id), prizes);
  return NextResponse.json({ ok: true, data: rows.map(serializePrize) });
}
