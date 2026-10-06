import "server-only";
import type { OptionChainData, OptionChainRow } from "@/components/trading/option-chain-panel";
import type { OptionLeg } from "@/lib/angelone-types";

/*
 * Option chain straight from NSE — no broker, no API key.
 *
 * NSE sits behind Akamai, which answers `{}` to anything that has not first
 * picked up a bot cookie by loading the site like a browser. So every call
 * warms a session against the homepage and the option-chain page, then reuses
 * those cookies until they go stale.
 *
 * The chain itself takes two requests: contract-info lists the expiries, and
 * v3 returns the strikes for one of them.
 */

const NSE = "https://www.nseindia.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const NAV_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

function apiHeaders(cookie: string): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "*/*",
    // identity: Akamai will otherwise brotli-encode and undici hands back bytes
    "Accept-Encoding": "identity",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    Referer: `${NSE}/option-chain`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    Cookie: cookie,
  };
}

const INDEX_SYMBOLS = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"]);

export function isIndexUnderlying(symbol: string): boolean {
  return INDEX_SYMBOLS.has(symbol.replace(/\s+/g, "").toUpperCase());
}

function readSetCookies(res: Response): string[] {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  // Call on the receiver — detaching getSetCookie throws Illegal invocation
  if (typeof h.getSetCookie === "function") return h.getSetCookie();
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

let session: { cookie: string; expires: number } | null = null;
const SESSION_TTL = 8 * 60_000;

async function getSession(force = false): Promise<string> {
  if (!force && session && session.expires > Date.now()) return session.cookie;

  const jar = new Map<string, string>();
  const collect = (res: Response) => {
    for (const c of readSetCookies(res)) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  };

  const home = await fetch(`${NSE}/`, { headers: NAV_HEADERS, redirect: "follow", cache: "no-store" });
  collect(home);

  const page = await fetch(`${NSE}/option-chain`, {
    headers: { ...NAV_HEADERS, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    redirect: "follow",
    cache: "no-store",
  });
  collect(page);

  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  session = { cookie, expires: Date.now() + SESSION_TTL };
  console.log("[nse-oc] session warmed (%d cookies)", jar.size);
  return cookie;
}

async function nseJson<T>(url: string, retryOnEmpty = true): Promise<T | null> {
  let cookie = await getSession();
  let res = await fetch(url, { headers: apiHeaders(cookie), cache: "no-store" });
  let text = res.ok ? await res.text() : "";

  // `{}` or a 401/403 means the bot cookie went stale — rewarm once and retry
  if (retryOnEmpty && (!res.ok || text.trim() === "{}" || text.length < 10)) {
    cookie = await getSession(true);
    res = await fetch(url, { headers: apiHeaders(cookie), cache: "no-store" });
    text = res.ok ? await res.text() : "";
  }

  if (!res.ok || text.trim() === "{}" || text.length < 10) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

type ContractInfo = { expiryDates?: string[] };

type NseLeg = {
  identifier?: string;
  lastPrice?: number;
  change?: number;
  pChange?: number;
  openInterest?: number;
  changeinOpenInterest?: number;
  pchangeinOpenInterest?: number;
  totalTradedVolume?: number;
  strikePrice?: number;
  underlyingValue?: number;
};

type ChainV3 = {
  records?: {
    data?: { strikePrice?: number; CE?: NseLeg; PE?: NseLeg }[];
    underlyingValue?: number;
  };
};

function toLeg(raw: NseLeg | undefined): OptionLeg | undefined {
  if (!raw?.identifier) return undefined;
  return {
    tradingsymbol: raw.identifier,
    token: raw.identifier,
    ltp: raw.lastPrice ?? 0,
    change: raw.change ?? 0,
    changePct: raw.pChange ?? 0,
    oi: raw.openInterest ?? 0,
    oiChange: raw.changeinOpenInterest ?? 0,
    oiChangePct: raw.pchangeinOpenInterest ?? 0,
    volume: raw.totalTradedVolume ?? 0,
  };
}

/** "06-Oct-2026" -> "06 Oct 26" */
function expiryLabel(code: string): string {
  const m = code.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  return m ? `${m[1]} ${m[2]} ${m[3].slice(2)}` : code;
}

export async function getNseOptionChain(opts: {
  symbol: string;
  expiry?: string;
}): Promise<OptionChainData | null> {
  const symbol = opts.symbol.replace(/\s+/g, "").toUpperCase();
  const isIndex = isIndexUnderlying(symbol);

  const info = await nseJson<ContractInfo>(
    `${NSE}/api/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}&instrument=${isIndex ? "OPTIDX" : "OPTSTK"}`,
  );
  const expiryDates = info?.expiryDates ?? [];
  if (expiryDates.length === 0) return null;

  const expiry = opts.expiry && expiryDates.includes(opts.expiry) ? opts.expiry : expiryDates[0];

  const chain = await nseJson<ChainV3>(
    `${NSE}/api/option-chain-v3?type=${isIndex ? "Indices" : "Equity"}&symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`,
  );
  const data = chain?.records?.data ?? [];
  if (data.length === 0) return null;

  const rows: OptionChainRow[] = [];
  const tokens: { token: string; exchange: string }[] = [];
  let spot = chain?.records?.underlyingValue ?? 0;

  for (const d of data) {
    const strike = d.strikePrice ?? d.CE?.strikePrice ?? d.PE?.strikePrice;
    if (strike == null) continue;
    if (!spot) spot = d.CE?.underlyingValue ?? d.PE?.underlyingValue ?? 0;

    const ce = toLeg(d.CE);
    const pe = toLeg(d.PE);
    if (ce) tokens.push({ token: ce.token, exchange: "NFO" });
    if (pe) tokens.push({ token: pe.token, exchange: "NFO" });
    rows.push({ strike, ce, pe });
  }

  rows.sort((a, b) => a.strike - b.strike);

  return {
    underlying: symbol,
    exchange: "NFO",
    expiry,
    expiries: expiryDates.map(code => ({ code, label: expiryLabel(code) })),
    spot,
    rows,
    tokens,
  };
}
