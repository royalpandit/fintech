import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  if (auth.role === "admin" || auth.role === "super_admin") {
    return NextResponse.json(
      { ok: false, error: "Admins cannot join competitions as participants" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  try {
    const participant = await competitionRepository.joinCompetition(
      Number(id),
      auth.userId,
      auth.role,
    );
    return NextResponse.json({
      ok: true,
      data: {
        competitionId: participant.competitionId,
        userId: participant.userId,
        joinedAt: participant.joinedAt.toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to join" },
      { status: 400 },
    );
  }
}
