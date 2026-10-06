import type { OptionChainData, OptionChainRow } from "@/components/trading/option-chain-panel";
import type { OptionLeg } from "@/lib/angelone-types";

const YAHOO_BASE = "https://query1.finance.yahoo.com";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BASE_HEADERS = { "User-Agent": UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" };

// Crumb + cookie cache (refreshed every hour)
let crumbCache: { crumb: string; cookie: string; expires: number } | null = null;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (crumbCache && crumbCache.expires > Date.now()) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }

  // Step 1: Fetch fc.yahoo.com to get session cookies
  const cookieRes = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
  // Extract cookies — use get("set-cookie") which works in all Node versions
  const rawCookie = cookieRes.headers.get("set-cookie") ?? "";
  const cookie = rawCookie.split(",").map(c => c.split(";")[0].trim()).filter(Boolean).join("; ");

  // Step 2: Exchange cookies for a crumb
  const crumbRes = await fetch(`${YAHOO_BASE}/v1/test/getcrumb`, {
    headers: { ...BASE_HEADERS, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).trim();

  crumbCache = { crumb, cookie, expires: Date.now() + 60 * 60_000 };
  console.log("[yahoo-options] crumb refreshed");
  return { crumb, cookie };
}

function unixToDateStr(ts: number): string {
  return new Date(ts * 1000).toISOString().split("T")[0]; // "2024-10-10"
}

function formatExpiryLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

export function yahooOptionsTicker(symbol: string, exchange: string): string | null {
  const ex = exchange.toUpperCase();
  if (ex === "IDX_I") {
    if (/BANK.*NIFTY|BANKNIFTY/i.test(symbol)) return "^NSEBANK";
    if (/NIFTY/i.test(symbol)) return "^NSEI";
    if (/SENSEX/i.test(symbol)) return "^BSESN";
  }
  if (ex === "NSE") return `${symbol}.NS`;
  if (ex === "BSE") return `${symbol}.BO`;
  return null;
}

export async function getYahooOptionChain(opts: {
  tradingSymbol: string;
  display: string;
  exchange: string;
  expiry?: string; // Unix timestamp string from Yahoo (e.g. "1728950400")
}): Promise<OptionChainData | null> {
  const ticker = yahooOptionsTicker(opts.tradingSymbol, opts.exchange)
    ?? yahooOptionsTicker(opts.display, opts.exchange);
  if (!ticker) return null;

  try {
    const { crumb, cookie } = await getYahooCrumb();

    const url = new URL(`${YAHOO_BASE}/v7/finance/options/${encodeURIComponent(ticker)}`);
    url.searchParams.set("crumb", crumb);
    if (opts.expiry && /^\d+$/.test(opts.expiry)) url.searchParams.set("date", opts.expiry);

    const res = await fetch(url.toString(), {
      headers: { ...BASE_HEADERS, Cookie: cookie },
    });

    if (res.status === 401) {
      crumbCache = null; // Force crumb refresh on next request
      return null;
    }
    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.optionChain?.result?.[0];
    if (!result) return null;

    const quote = result.quote ?? {};
    const expirationDates: number[] = result.expirationDates ?? [];

    const expiries = expirationDates.map(ts => ({
      code: String(ts),
      label: formatExpiryLabel(unixToDateStr(ts)),
    }));

    const optData = result.options?.[0];
    if (!optData) return null;

    const calls: Record<number, OptionLeg> = {};
    const puts: Record<number, OptionLeg> = {};
    const tokens: { token: string; exchange: string }[] = [];

    for (const c of optData.calls ?? []) {
      calls[c.strike] = {
        tradingsymbol: c.contractSymbol,
        token: c.contractSymbol,
        ltp: c.lastPrice,
        change: c.change,
        changePct: c.percentChange,
        oi: c.openInterest ?? 0,
        volume: c.volume ?? 0,
      };
      tokens.push({ token: c.contractSymbol, exchange: "NFO" });
    }

    for (const p of optData.puts ?? []) {
      puts[p.strike] = {
        tradingsymbol: p.contractSymbol,
        token: p.contractSymbol,
        ltp: p.lastPrice,
        change: p.change,
        changePct: p.percentChange,
        oi: p.openInterest ?? 0,
        volume: p.volume ?? 0,
      };
      tokens.push({ token: p.contractSymbol, exchange: "NFO" });
    }

    const allStrikes = [
      ...new Set([...Object.keys(calls), ...Object.keys(puts)].map(Number))
    ].sort((a, b) => a - b);

    const rows: OptionChainRow[] = allStrikes.map(strike => ({
      strike,
      ce: calls[strike],
      pe: puts[strike],
    }));

    return {
      underlying: opts.display || opts.tradingSymbol,
      exchange: opts.exchange === "IDX_I" ? "NSE" : opts.exchange,
      expiry: String(optData.expirationDate ?? expirationDates[0] ?? ""),
      expiries,
      spot: quote.regularMarketPrice,
      spotChange: quote.regularMarketChange,
      spotChangePct: quote.regularMarketChangePercent,
      rows,
      tokens,
    };
  } catch (err) {
    console.error("[yahoo-options] fetch error:", err instanceof Error ? err.message : err);
    return null;
  }
}
