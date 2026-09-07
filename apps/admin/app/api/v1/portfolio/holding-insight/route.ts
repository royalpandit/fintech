import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { loadHolding } from "@/lib/holding-position";
import {
  getHoldingInsight,
  HOLDING_AGENTS,
  type HoldingAgentKey,
} from "@/lib/holding-insight";

export const dynamic = "force-dynamic";
// Three of these run in parallel from the page, and a grounded Gemini call on a
// cold cache is not fast. The default 10s ceiling cut them off mid-answer.
export const maxDuration = 60;

/**
 * GET /api/v1/portfolio/holding-insight?symbol=RELIANCE&agent=research
 *
 * One agent's read on one position the caller actually holds.
 *
 * Fetched per panel rather than all three server-side with the page, so the
 * position and trade history paint immediately and each analysis fills in when
 * it is ready — one slow agent does not hold up the other two or the page.
 *
 * The position is re-derived here from the caller's own wallet rather than
 * accepted from the request: a client that could post its own quantity and
 * average cost could have the agent reason about a position that does not
 * exist.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const symbol = (params.get("symbol") ?? "").trim().toUpperCase();
  const agent = (params.get("agent") ?? "") as HoldingAgentKey;

  if (!symbol) {
    return NextResponse.json({ ok: false, error: "symbol is required" }, { status: 400 });
  }
  if (!HOLDING_AGENTS.some((a) => a.key === agent)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unknown agent. Valid: ${HOLDING_AGENTS.map((a) => a.key).join(", ")}`,
      },
      { status: 400 },
    );
  }

  const holding = await loadHolding(auth.userId, symbol);
  if (!holding) {
    return NextResponse.json(
      { ok: false, error: `You do not hold ${symbol}.` },
      { status: 404 },
    );
  }

  const result = await getHoldingInsight(auth.userId, agent, holding.context);
  if (!result.ok) {
    // 200 with ok:false: the panel renders the reason in place. A 5xx here
    // would make an unavailable agent look like a broken page.
    return NextResponse.json({ ok: false, error: result.error ?? "Unavailable" });
  }

  return NextResponse.json({
    ok: true,
    agent: result.agent,
    text: result.text ?? "",
    cached: result.cached,
  });
}
