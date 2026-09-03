import { NextResponse, type NextRequest } from "next/server";
import { getOHLC } from "@/lib/dhan";
import { getEtfList } from "@/lib/scrip-master";

import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Live quotes are a nice-to-have; never let a slow broker hold up the list. */
const QUOTE_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("quote timeout")), ms)),
  ]);
}

type Quote = { token: string; ltp: number | null; percentChange: number | null };

// Covering all 138 ETFs takes three chunked broker calls (~3s). Hold the result
// briefly so re-opening the tab is instant; 30s of staleness on an ETF list is
// not meaningful.
let quoteCache: { quotes: Quote[]; at: number } | null = null;
const QUOTE_TTL_MS = 30_000;

export async function GET(req: NextRequest) {
  // These proxy upstream providers — one of them spends Angel One quota —
  // so they match their siblings and stay behind auth. The Markets page is
  // authed anyway; only /api/v1/market/fx is deliberately public.
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { etfs, source, count } = await getEtfList(false, { allowDownload: false });

    let quotes: Quote[] = quoteCache && Date.now() - quoteCache.at < QUOTE_TTL_MS ? quoteCache.quotes : [];
    if (!quotes.length) try {
      // OHLC rather than LTP mode: LTP mode returns only a price, so the change
      // came back 0 for every row and rendered as a flat green +0.00%. OHLC
      // carries the previous close, which is what the change is measured from.
      // getOHLC chunks at 50 tokens per call, so the whole list is covered.
      const fetched = await withTimeout(
        getOHLC(etfs.map((e) => ({ exchange: e.exchange, symboltoken: e.token }))),
        QUOTE_TIMEOUT_MS,
      );
      quotes = fetched.map((q) => {
        const ltp = Number(q.ltp) || null;
        const prevClose = Number(q.close) || null;
        const reported = Number(q.percentChange);
        const derived =
          ltp != null && prevClose != null && prevClose > 0
            ? ((ltp - prevClose) / prevClose) * 100
            : null;
        return {
          token: String(q.symbolToken ?? ""),
          ltp,
          percentChange: derived ?? (Number.isFinite(reported) && reported !== 0 ? reported : null),
        };
      });
      if (quotes.length) quoteCache = { quotes, at: Date.now() };
    } catch {
      // List still useful without live quotes.
      if (quoteCache) quotes = quoteCache.quotes;
    }

    const byToken = new Map(quotes.map((q) => [q.token, q]));
    const rows = etfs.map((e) => {
      const q = byToken.get(e.token);
      return { ...e, ltp: q?.ltp ?? null, percentChange: q?.percentChange ?? null };
    });
    return NextResponse.json({
      ok: true,
      warming: source === "warming",
      etfs: rows,
      source,
      masterCount: count,
      quoted: quotes.length,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Couldn't load ETFs", etfs: [] },
      { status: 502 },
    );
  }
}

