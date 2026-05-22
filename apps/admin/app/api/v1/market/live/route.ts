import { NextResponse } from "next/server";
import { getLTP, MARKET_INSTRUMENTS } from "@/lib/angelone";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/market/live
 * Returns live LTP for all preset NSE/BSE instruments.
 * Optionally filter by ?symbols=RELIANCE,TCS (comma-separated)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("symbols");

    const instruments =
      filter
        ? MARKET_INSTRUMENTS.filter((m) =>
            filter.split(",").includes(m.symbol)
          )
        : [...MARKET_INSTRUMENTS];

    const fetchable = instruments.map((m) => ({
      exchange: m.exchange,
      symboltoken: m.token,
    }));

    const quotes = await getLTP(fetchable);

    // Attach our readable symbol name to each quote
    const tokenMap = Object.fromEntries(
      instruments.map((m) => [m.token, m.symbol])
    );
    const enriched = quotes.map((q: { symbolToken: string; [k: string]: unknown }) => ({
      ...q,
      displaySymbol: tokenMap[q.symbolToken] ?? q.symbolToken,
    }));

    return NextResponse.json({ ok: true, data: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
