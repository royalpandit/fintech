import "server-only";
import { getYahooQuotes } from "@/lib/yahoo-quote";
import { withFeedCache } from "@/lib/market-rate-limit";

/*
 * Verified facts, handed to the writer.
 *
 * The model that writes these posts cannot search. Asked what the Nifty closed
 * at it answers "NO CURRENT DATA", which is honest and useless, and pushed
 * harder it would invent a number — the failure the brief forbids above all
 * else. So the facts are not something the model is trusted to find. They are
 * fetched here, from the feeds this app already runs on, and pasted into the
 * prompt as the only numbers it is permitted to use.
 *
 * That makes the writing job narrow on purpose: it analyses figures that have
 * already been checked rather than recalling any. Everything here is free and
 * unauthenticated — Yahoo for prices, public RSS for news — so none of it can
 * expire or bill.
 */

export type ContextPack =
  | "indices"
  | "movers"
  | "commodities"
  | "global"
  | "currency"
  | "news"
  | "none";

/** Which facts an agent needs, from the category the catalogue already gives it. */
export function packForCategory(category: string): ContextPack {
  switch (category) {
    case "market":
    case "sectors":
      return "indices";
    case "stocks":
    case "ideas":
    case "technical":
      return "movers";
    case "commodities":
      return "commodities";
    case "global":
      return "global";
    case "macro":
      return "currency";
    case "ipo":
    case "earnings":
    case "policy":
    case "flows":
    case "mutual-funds":
      return "news";
    default:
      // Psychology, stories, debate, personal finance: reasoning and worked
      // examples, with no live figure to get wrong.
      return "none";
  }
}

const num = (v: unknown, dp = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(dp) : "n/a";
};

function line(label: string, q: { ltp?: number; close?: number; percentChange?: number; high?: number; low?: number }) {
  const pct = Number(q.percentChange);
  const sign = Number.isFinite(pct) && pct >= 0 ? "+" : "";
  return `  ${label.padEnd(16)} ${num(q.ltp).padStart(10)}   ${sign}${num(pct)}%   prev close ${num(q.close)}   day ${num(q.low)}–${num(q.high)}`;
}

async function quotes(items: { label: string; symbol: string; exchange: string }[]) {
  const rows = await getYahooQuotes(
    items.map(i => ({ exchange: i.exchange, symboltoken: i.symbol, tradingSymbol: i.symbol })),
  );
  const by = new Map(rows.map(r => [r.tradingSymbol.toUpperCase(), r]));
  return items
    .map(i => {
      const q = by.get(i.symbol.toUpperCase());
      return q && Number(q.ltp) > 0 ? line(i.label, q) : null;
    })
    .filter(Boolean)
    .join("\n");
}

const INDIAN_INDICES = [
  { label: "NIFTY 50", symbol: "NIFTY 50", exchange: "IDX_I" },
  { label: "SENSEX", symbol: "SENSEX", exchange: "IDX_I" },
  { label: "NIFTY BANK", symbol: "NIFTY BANK", exchange: "IDX_I" },
];

const WATCHLIST = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
  "SBIN", "BHARTIARTL", "ITC", "LT", "AXISBANK",
].map(s => ({ label: s, symbol: s, exchange: "NSE" }));

const COMMODITIES = [
  { label: "Gold $/oz", symbol: "GC=F", exchange: "NSE" },
  { label: "Silver $/oz", symbol: "SI=F", exchange: "NSE" },
  { label: "Copper $/lb", symbol: "HG=F", exchange: "NSE" },
  { label: "Brent $/bbl", symbol: "BZ=F", exchange: "NSE" },
];

const GLOBAL = [
  { label: "S&P 500", symbol: "^GSPC", exchange: "IDX_I" },
  { label: "Nasdaq", symbol: "^IXIC", exchange: "IDX_I" },
  { label: "Dow", symbol: "^DJI", exchange: "IDX_I" },
  { label: "Nikkei", symbol: "^N225", exchange: "IDX_I" },
  { label: "Hang Seng", symbol: "^HSI", exchange: "IDX_I" },
];

const CURRENCY = [
  { label: "USD/INR", symbol: "USDINR=X", exchange: "IDX_I" },
  { label: "Dollar Index", symbol: "DX-Y.NYB", exchange: "IDX_I" },
  { label: "US 10Y %", symbol: "^TNX", exchange: "IDX_I" },
];

/*
 * Public market RSS. Several, because any one of them can be having a bad
 * morning, and a writer with no headlines has nothing to write about.
 */
const FEEDS = [
  "https://www.business-standard.com/rss/markets-106.rss",
  "https://www.moneycontrol.com/rss/MCtopnews.xml",
  "https://feeds.feedburner.com/ndtvprofit-latest",
];

const RSS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").replace(/&amp;/g, "&").trim();
}

async function headlines(): Promise<string> {
  const out: string[] = [];
  for (const url of FEEDS) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": RSS_UA }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
      if (!res.ok) continue;
      const xml = await res.text();
      for (const item of xml.split("<item>").slice(1, 13)) {
        const t = item.match(/<title>([\s\S]*?)<\/title>/);
        const d = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        if (!t) continue;
        const title = stripCdata(t[1]!);
        if (title) out.push(`  • ${title}${d ? `  (${stripCdata(d[1]!)})` : ""}`);
      }
    } catch {
      // One feed down is not a reason to write nothing.
    }
    if (out.length >= 24) break;
  }
  return out.slice(0, 24).join("\n");
}

async function build(pack: ContextPack): Promise<string> {
  switch (pack) {
    case "indices":   return `Indian indices, live:\n${await quotes(INDIAN_INDICES)}`;
    case "movers":    return `Indian indices:\n${await quotes(INDIAN_INDICES)}\n\nLarge caps, live:\n${await quotes(WATCHLIST)}`;
    case "commodities": return `Commodities, live:\n${await quotes(COMMODITIES)}`;
    case "global":    return `Global markets, live:\n${await quotes(GLOBAL)}`;
    case "currency":  return `Currency and rates, live:\n${await quotes(CURRENCY)}\n\nIndian indices:\n${await quotes(INDIAN_INDICES)}`;
    case "news":      return `Current market headlines:\n${await headlines()}`;
    case "none":      return "";
  }
}

/**
 * The facts block for one agent, cached briefly.
 *
 * Agents sharing a pack within the same few minutes read the same figures,
 * which is both cheaper and better: two posts published minutes apart should
 * not quote the index at two different levels.
 *
 * Returns null when a pack that needs data could not get any. The caller does
 * not publish on null — a market post with no verified figures is the thing
 * this whole arrangement exists to prevent.
 */
export async function buildContext(pack: ContextPack): Promise<string | null> {
  if (pack === "none") return "";
  try {
    const text = await withFeedCache(`agent-ctx:${pack}`, 3 * 60_000, 10 * 60_000, () => build(pack));
    // A heading with nothing under it is not data.
    return text && text.split("\n").filter(l => l.trim().startsWith("•") || l.trim().match(/^\S+\s+[\d.]/)).length > 0
      ? text
      : null;
  } catch {
    return null;
  }
}
