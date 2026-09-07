import "server-only";

import { fetchJson } from "@/lib/provider-failover";
import type { ExtendedQuoteData } from "@/lib/dhan";
import type { QuoteInstrument } from "@/lib/dhan";

/**
 * Yahoo Finance as a standby quote source for Indian instruments.
 *
 * Dhan is the primary feed and stays that way: it is the only one that can
 * price the whole instrument master, and its access token is what the paper
 * order path already trusts. But the token expires every day, and when it does
 * every Dhan call returns `808 Authentication Failed` — which emptied the
 * entire Markets tab, indices and all, until somebody noticed and rotated it.
 *
 * A read-only public feed behind it turns that from an outage into a
 * degradation. What Yahoo cannot do is fill orders: it has no security ids and
 * no depth, so lib/paper-market-quote.ts deliberately does NOT fall back here.
 * A trade filled against a delayed third-party price would be worse than a
 * trade that is refused.
 *
 * Yahoo's data is delayed (typically ~15 minutes for NSE) and unofficial, so
 * every row it produces is tagged and the UI says where the numbers came from.
 */

const BASE = (process.env.YAHOO_FINANCE_BASE_URL || "https://query1.finance.yahoo.com/v8/finance/chart")
  .replace(/\/$/, "");

// Yahoo blocks the default undici agent string.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json",
};

/**
 * Indices carry Yahoo's own tickers; cash equities are the NSE symbol with a
 * ".NS" suffix. Anything not listed here (derivatives, and any instrument whose
 * Dhan trading symbol is not a plain NSE ticker) has no Yahoo equivalent and is
 * skipped rather than guessed at.
 */
const INDEX_TICKERS: Record<string, string> = {
  "NIFTY 50": "^NSEI",
  NIFTY: "^NSEI",
  "NIFTY BANK": "^NSEBANK",
  BANKNIFTY: "^NSEBANK",
  SENSEX: "^BSESN",
  "NIFTY NEXT 50": "^NSMIDCP",
  "INDIA VIX": "^INDIAVIX",
};

export function yahooTickerFor(symbol: string, exchange: string): string | null {
  const sym = symbol.trim().toUpperCase();
  const exch = exchange.trim().toUpperCase();

  const index = INDEX_TICKERS[sym];
  if (index) return index;
  // An index we have no mapping for: a ".NS" guess would resolve to something
  // else entirely, so return nothing.
  if (exch === "IDX_I") return null;

  if (exch === "BSE") return `${sym.replace(/-EQ$/, "")}.BO`;
  if (exch === "NSE" || exch === "NSE_EQ" || exch === "") {
    const clean = sym.replace(/-EQ$/, "");
    // Yahoo tickers are alphanumeric plus & and -; a space means this is not a
    // plain cash ticker.
    if (!/^[A-Z0-9&-]+$/.test(clean)) return null;
    return `${clean}.NS`;
  }
  return null;
}

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
      };
      indicators?: { quote?: Array<{ open?: (number | null)[] }> };
    }>;
    error?: { description?: string } | null;
  };
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function fetchOne(
  inst: QuoteInstrument & { tradingSymbol: string },
): Promise<ExtendedQuoteData | null> {
  const ticker = yahooTickerFor(inst.tradingSymbol, inst.exchange);
  if (!ticker) return null;

  const data = await fetchJson<YahooChart>(
    `${BASE}/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
    { headers: HEADERS, timeoutMs: 8_000 },
  );

  const result = data.chart?.result?.[0];
  const meta = result?.meta;
  const ltp = num(meta?.regularMarketPrice);
  if (ltp <= 0) return null;

  // Yahoo leaves `previousClose` null on this endpoint and puts the value in
  // `chartPreviousClose`; reading only the former yielded a 0 close and a
  // -100% change on every row.
  const prevClose = num(meta?.chartPreviousClose ?? meta?.previousClose);

  // Today's open is the last daily bar's open — the meta block has no open.
  const opens = result?.indicators?.quote?.[0]?.open ?? [];
  const open = num(opens[opens.length - 1]);

  const netChange = prevClose ? ltp - prevClose : 0;

  return {
    exchange: inst.exchange,
    tradingSymbol: inst.tradingSymbol,
    symbolToken: inst.symboltoken,
    open: open || ltp,
    high: num(meta?.regularMarketDayHigh) || ltp,
    low: num(meta?.regularMarketDayLow) || ltp,
    close: prevClose,
    ltp,
    netChange,
    percentChange: prevClose ? (netChange / prevClose) * 100 : 0,
    tradeVolume: num(meta?.regularMarketVolume),
    week52High: num(meta?.fiftyTwoWeekHigh) || undefined,
    week52Low: num(meta?.fiftyTwoWeekLow) || undefined,
  };
}

/**
 * Quotes for as many of `instruments` as Yahoo can price.
 *
 * One request per symbol — Yahoo's batch quote endpoint now demands a
 * cookie/crumb pair, and this chart endpoint does not. Requests run together
 * because they are independent and, unlike Dhan, are not sharing one serialized
 * REST chain.
 *
 * Partial results are returned rather than thrown away: a single delisted or
 * misnamed ticker should not blank the board.
 */
export async function getYahooQuotes(
  instruments: (QuoteInstrument & { tradingSymbol: string })[],
): Promise<ExtendedQuoteData[]> {
  if (!instruments.length) return [];
  const settled = await Promise.allSettled(instruments.map(fetchOne));
  const out: ExtendedQuoteData[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  if (!out.length) throw new Error("Yahoo returned no usable quotes");
  return out;
}
