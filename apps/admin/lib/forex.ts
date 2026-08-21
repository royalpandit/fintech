import "server-only";

import { fetchJson, firstSuccess } from "@/lib/provider-failover";

/**
 * FX rates against the Indian Rupee.
 *
 * open.er-api.com returns every pair in one keyless call but carries no
 * previous close, so it can't produce a day change. Yahoo's chart endpoint does
 * carry `chartPreviousClose`, but needs one request per pair. So: er-api for
 * the full table, Yahoo for the day change on the majors only — and Yahoo as
 * the price fallback if er-api is down.
 */

export type ForexRate = {
  code: string;
  name: string;
  /** Units of this currency per 1 INR. */
  perInr: number;
  /** 1 unit of this currency in INR. */
  inrValue: number;
  /** Day change in percent, when a previous close was available. */
  changePct: number | null;
};

const NAMES: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  AUD: "Australian Dollar",
  CAD: "Canadian Dollar",
  CNY: "Chinese Yuan",
  AED: "UAE Dirham",
  SGD: "Singapore Dollar",
  CHF: "Swiss Franc",
  HKD: "Hong Kong Dollar",
  NZD: "New Zealand Dollar",
  KRW: "South Korean Won",
  THB: "Thai Baht",
  MYR: "Malaysian Ringgit",
  SAR: "Saudi Riyal",
  QAR: "Qatari Riyal",
  KWD: "Kuwaiti Dinar",
  BHD: "Bahraini Dinar",
  OMR: "Omani Rial",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  PLN: "Polish Zloty",
  TRY: "Turkish Lira",
  ZAR: "South African Rand",
  BRL: "Brazilian Real",
  MXN: "Mexican Peso",
  RUB: "Russian Ruble",
  IDR: "Indonesian Rupiah",
  PHP: "Philippine Peso",
  VND: "Vietnamese Dong",
  TWD: "New Taiwan Dollar",
};

/** Shown first, and the only pairs we spend a Yahoo request on for change %. */
const PRIORITY = [
  "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CNY", "AED", "SGD", "CHF",
  "HKD", "NZD", "KRW", "SAR", "THB", "MYR", "SEK", "NOK", "ZAR", "BRL",
];

/** Pairs the landing ticker and any compact widget need. */
export const TICKER_PAIRS = ["USD", "EUR", "GBP", "JPY"];

const ER_API_URL = process.env.FOREX_BASE_URL || "https://open.er-api.com/v6/latest/INR";
const YAHOO_BASE =
  process.env.YAHOO_FINANCE_BASE_URL || "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_UA =
  process.env.NSE_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type YahooChart = {
  chart?: {
    result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }[];
  };
};

/** One Yahoo pair: `USDINR=X` is 1 USD in INR. */
async function yahooPair(code: string): Promise<{ inrValue: number; changePct: number | null }> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(`${code}INR=X`)}?range=5d&interval=1d`;
  const j = await fetchJson<YahooChart>(url, {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    timeoutMs: 8_000,
  });
  const meta = j.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`no price for ${code}INR`);
  const prev = Number(meta?.chartPreviousClose);
  const changePct =
    Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : null;
  return { inrValue: price, changePct };
}

type ErApi = { rates?: Record<string, number> };

async function fromErApi(): Promise<ForexRate[]> {
  const j = await fetchJson<ErApi>(ER_API_URL, { timeoutMs: 10_000 });
  const inrRates = j.rates ?? {};
  const codes = Object.keys(inrRates).filter(
    (c) => c !== "INR" && Number.isFinite(inrRates[c]) && inrRates[c] > 0,
  );
  if (!codes.length) throw new Error("er-api returned no rates");

  const prioritySet = new Set(PRIORITY);
  const ordered = [
    ...PRIORITY.filter((c) => codes.includes(c)),
    ...codes.filter((c) => !prioritySet.has(c)).sort(),
  ];
  return ordered.map((c) => ({
    code: c,
    name: NAMES[c] ?? c,
    perInr: inrRates[c],
    inrValue: 1 / inrRates[c],
    changePct: null,
  }));
}

/** Fallback price source — majors only, but it carries the day change. */
async function fromYahoo(): Promise<ForexRate[]> {
  const settled = await Promise.allSettled(PRIORITY.map((c) => yahooPair(c)));
  const rates: ForexRate[] = [];
  settled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const code = PRIORITY[i];
    rates.push({
      code,
      name: NAMES[code] ?? code,
      perInr: 1 / r.value.inrValue,
      inrValue: r.value.inrValue,
      changePct: r.value.changePct,
    });
  });
  if (!rates.length) throw new Error("yahoo returned no FX pairs");
  return rates;
}

/** Best-effort day change for the majors; never fails the request. */
async function attachChanges(rates: ForexRate[]): Promise<void> {
  const wanted = rates.filter((r) => PRIORITY.includes(r.code) && r.changePct == null);
  if (!wanted.length) return;
  const settled = await Promise.allSettled(wanted.map((r) => yahooPair(r.code)));
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") wanted[i].changePct = res.value.changePct;
  });
}

let cache: { rates: ForexRate[]; source: string; at: number } | null = null;
const TTL_MS = 10 * 60_000;

export async function getForexRates(): Promise<{
  rates: ForexRate[];
  source: string;
  fetchedAt: string;
  stale?: boolean;
}> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { rates: cache.rates, source: cache.source, fetchedAt: new Date(cache.at).toISOString() };
  }
  try {
    const { value, provider } = await firstSuccess<ForexRate[]>([
      { name: "open.er-api.com", run: fromErApi },
      { name: "yahoo-finance", run: fromYahoo },
    ]);
    await attachChanges(value);
    cache = { rates: value, source: provider, at: Date.now() };
    return { rates: value, source: provider, fetchedAt: new Date(cache.at).toISOString() };
  } catch (e) {
    if (cache) {
      return {
        rates: cache.rates,
        source: cache.source,
        fetchedAt: new Date(cache.at).toISOString(),
        stale: true,
      };
    }
    throw e;
  }
}
