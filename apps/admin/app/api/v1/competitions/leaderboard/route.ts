import { NextResponse, type NextRequest } from "next/server";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

// Global reputation leaderboard: ?period=all | weekly | monthly
export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("period") ?? "all";
  const period = (["all", "weekly", "monthly"].includes(raw) ? raw : "all") as
    | "all"
    | "weekly"
    | "monthly";
  const data = await competitionRepository.getGlobalLeaderboard(period);
  return NextResponse.json({ ok: true, data, period });
}
