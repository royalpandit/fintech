import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseCompetitionTab, serializeCompetition } from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const tab = parseCompetitionTab(req.nextUrl.searchParams.get("tab"));
  const effectiveTab = tab === "my" ? tab : tab;

  const rows = await competitionRepository.listCompetitions({
    tab: "my",
    userId: auth.userId,
    publicOnly: false,
  });

  const filtered = rows.filter((c) => {
    const effective =
      c.status === "cancelled"
        ? "cancelled"
        : c.endDate < new Date()
          ? "completed"
          : c.startDate > new Date()
            ? "upcoming"
            : "live";
    if (effectiveTab === "live") return effective === "live";
    if (effectiveTab === "upcoming") return effective === "upcoming";
    if (effectiveTab === "completed") return effective === "completed";
    return true;
  });

  return NextResponse.json({
    ok: true,
    data: filtered.map((c) => serializeCompetition(c, { joined: true, userId: auth.userId })),
    meta: { tab: effectiveTab },
  });
}
