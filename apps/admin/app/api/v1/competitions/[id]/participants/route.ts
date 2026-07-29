import { NextResponse, type NextRequest } from "next/server";
import { competitionTradingRepository } from "@/lib/competition-trading-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await competitionTradingRepository.listPublicParticipants(Number(id));

  return NextResponse.json({
    ok: true,
    data: rows.map((p) => ({
      id: p.id,
      userName: p.user.fullName,
      roleLabel: p.roleKey,
      joinedAt: p.joinedAt.toISOString(),
      profileImage: p.user.advisorProfile?.profileImageUrl ?? null,
    })),
    meta: { total: rows.length },
  });
}
