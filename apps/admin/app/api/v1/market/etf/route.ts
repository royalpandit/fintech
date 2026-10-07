import { NextResponse } from "next/server";
import { getEtfList, type EtfRow } from "@/lib/scrip-master";
import { getYahooQuotes } from "@/lib/yahoo-quote";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * Public, like every other tab on the Markets page. This sat behind auth on the
 * assumption that the page was authed, which it is not — guests read indices,
 * charts and the option chain, so the ETF tab answered 401 and rendered empty.
 * Nothing here is per-user.
 */

type Quote = { token: string; ltp: number | null; percentChange: number | null };

/** Live quotes are a nice-to-have; never let a slow feed hold up the list. */
const QUOTE_DEADLINE_MS = 20_000;
const QUOTE_TTL_MS = 60_000;
const BATCH = 20;

let quoteCache: { quotes: Quote[]; at: number } | null = null;

/*
 * Yahoo is one request per symbol and the list runs to ~140, so they go out in
 * batches rather than opening every socket at once, and stop at a deadline.
 * Whatever is priced by then is returned: a missing price is a blank cell, not
 * a failed page.
 *
 * Quotes used to come from the broker, which meant an expired token emptied
 * every price column here even though the list itself needs no credentials.
 */
async function quoteEtfs(etfs: EtfRow[]): Promise<Quote[]> {
  const out: Quote[] = [];
  const deadline = Date.now() + QUOTE_DEADLINE_MS;

  for (let i = 0; i < etfs.length && Date.now() < deadline; i += BATCH) {
    const slice = etfs.slice(i, i + BATCH);
    try {
      const got = await getYahooQuotes(
        slice.map((e) => ({
          exchange: e.exchange,
          symboltoken: e.token,
          tradingSymbol: e.symbol,
        })),
      );
      for (const q of got) {
        const ltp = Number(q.ltp) || null;
        const pct = Number(q.percentChange);
        out.push({
          token: String(q.symbolToken ?? ""),
          ltp,
          percentChange: Number.isFinite(pct) ? pct : null,
        });
      }
    } catch {
      // Yahoo could price nothing in this batch — those cells stay blank.
    }
  }
  return out;
}

export async function GET() {
  try {
    const { etfs, source, count } = await getEtfList(false, { allowDownload: false });

    let quotes: Quote[] =
      quoteCache && Date.now() - quoteCache.at < QUOTE_TTL_MS ? quoteCache.quotes : [];
    if (!quotes.length && etfs.length) {
      quotes = await quoteEtfs(etfs);
      if (quotes.length) quoteCache = { quotes, at: Date.now() };
      else if (quoteCache) quotes = quoteCache.quotes;
    }

    const byToken = new Map(quotes.map((q) => [q.token, q]));
    const rows = etfs.map((e) => {
      const q = byToken.get(e.token);
      return { ...e, ltp: q?.ltp ?? null, percentChange: q?.percentChange ?? null };
    });

    console.log("[etf] %d rows, %d quoted (source=%s)", rows.length, quotes.length, source);
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
