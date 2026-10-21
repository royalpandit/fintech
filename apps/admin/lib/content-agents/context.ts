import "server-only";
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

/**
 * Which facts an agent needs.
 *
 * Category alone was too coarse. "sectors" covers both Sector Pre-Open, which
 * reads index levels, and the AI and Defence desks, which need news — and
 * handed index levels the AI writer correctly replied that it had no AI data
 * and declined. Same for Corporate Announcement Movers, filed under "stocks"
 * and given large-cap prices when what it reports is announcements.
 *
 * So the agents whose beat is events rather than levels are named here, and
 * category decides the rest.
 */
const NEWS_AGENTS = new Set([
  13, 14, 15, 16, // policy, regulatory, announcements, orders
  63, 64, 65, 66, 67, 68, 71, 72, // AI, semis, defence, power, data centres, cyber, EV, trends
  77, 78, 80, // government policy, budget, geopolitics
  51, // management quality
]);

export function packForAgent(agentNo: number, category: string): ContextPack {
  if (NEWS_AGENTS.has(agentNo)) return "news";
  return packForCategory(category);
}

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

const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json",
};

type Row = { label: string; ticker: string };

/*
 * Yahoo tickers, written out rather than derived.
 *
 * lib/yahoo-quote maps Indian names — RELIANCE to RELIANCE.NS, SENSEX to
 * ^BSESN — and returns null for anything that is not one, which is every
 * ticker on this page: ^GSPC, GC=F and USDINR=X all came back null and took
 * the commodities, global and currency packs down with them. Three of six
 * packs produced nothing at all, so every agent on them failed.
 *
 * Here the ticker IS the identifier, so there is nothing to resolve.
 */
async function quote(row: Row): Promise<string | null> {
  try {
    const res = await fetch(
      `${YAHOO}/${encodeURIComponent(row.ticker)}?interval=1d&range=5d`,
      { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(10_000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: { meta?: Record<string, unknown>; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
    };
    const r = json.chart?.result?.[0];
    const ltp = Number(r?.meta?.regularMarketPrice);
    if (!Number.isFinite(ltp) || ltp <= 0) return null;

    // Same rule the quote path uses: the final daily bar is the live session
    // once trading opens, so the previous close is the bar before it.
    const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter(
      (c): c is number => c != null && Number.isFinite(c),
    );
    const last = closes[closes.length - 1];
    const prev =
      last != null && Math.abs(last - ltp) <= Math.max(0.01, ltp * 1e-6)
        ? closes[closes.length - 2]
        : last;

    const pct = prev ? ((ltp - prev) / prev) * 100 : 0;
    const sign = pct >= 0 ? "+" : "";
    const dp = ltp < 10 ? 4 : 2;
    return `  ${row.label.padEnd(16)} ${num(ltp, dp).padStart(11)}   ${sign}${num(pct)}%   prev close ${num(prev, dp)}`;
  } catch {
    return null;
  }
}

async function quotes(rows: Row[]): Promise<string> {
  const out = await Promise.all(rows.map(quote));
  return out.filter(Boolean).join("\n");
}

const INDIAN_INDICES: Row[] = [
  { label: "NIFTY 50", ticker: "^NSEI" },
  { label: "SENSEX", ticker: "^BSESN" },
  { label: "NIFTY BANK", ticker: "^NSEBANK" },
];

const WATCHLIST: Row[] = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
  "SBIN", "BHARTIARTL", "ITC", "LT", "AXISBANK",
].map(s => ({ label: s, ticker: `${s}.NS` }));

const COMMODITIES: Row[] = [
  { label: "Gold $/oz", ticker: "GC=F" },
  { label: "Silver $/oz", ticker: "SI=F" },
  { label: "Copper $/lb", ticker: "HG=F" },
  { label: "Brent $/bbl", ticker: "BZ=F" },
];

const GLOBAL: Row[] = [
  { label: "S&P 500", ticker: "^GSPC" },
  { label: "Nasdaq", ticker: "^IXIC" },
  { label: "Dow", ticker: "^DJI" },
  { label: "Nikkei", ticker: "^N225" },
  { label: "Hang Seng", ticker: "^HSI" },
];

const CURRENCY: Row[] = [
  { label: "USD/INR", ticker: "USDINR=X" },
  { label: "Dollar Index", ticker: "DX-Y.NYB" },
  { label: "US 10Y %", ticker: "^TNX" },
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
