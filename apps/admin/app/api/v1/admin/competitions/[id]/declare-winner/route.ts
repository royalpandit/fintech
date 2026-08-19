import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyCompetition } from "@/lib/notify";
import { serializeCompetition } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const winningOptionId = Number(body.winningOptionId ?? body.winning_option_id);

  if (!Number.isFinite(winningOptionId)) {
    return NextResponse.json({ ok: false, error: "winningOptionId is required" }, { status: 400 });
  }

  try {
    const row = await competitionRepository.declareWinner(Number(id), winningOptionId);

    // Everyone who predicted deserves to hear the result.
    try {
      const competitionId = Number(id);
      const predictions = await prisma.competitionPrediction.findMany({
        where: { competitionId },
        select: { userId: true, optionId: true },
      });
      for (const p of predictions) {
        const won = p.optionId === winningOptionId;
        await notifyCompetition({
          userId: p.userId,
          competitionId,
          title: won ? "You called it 🎉" : "Competition result is in",
          message: won
            ? `Your prediction on "${row?.title ?? "the competition"}" was correct.`
            : `"${row?.title ?? "The competition"}" has been settled — see the result.`,
        });
      }
    } catch {
      // Never fail the declaration because notifications couldn't be sent.
    }

    return NextResponse.json({ ok: true, data: serializeCompetition(row!) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to declare winner" },
      { status: 400 },
    );
  }
}
