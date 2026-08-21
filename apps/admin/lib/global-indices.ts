import "server-only";

import { fetchJson, firstSuccess, type Provider } from "@/lib/provider-failover";

export type GlobalIndex = {
  id: string;
  name: string;
  region: string;
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  currency: string;
};

type Spec = {
  id: string;
  name: string;
  region: string;
  yahoo: string;
  twelve: string;
};

const INDICES: Spec[] = [
  { id: "sp500", name: "S&P 500", region: "US", yahoo: "^GSPC", twelve: "SPX" },
  { id: "nasdaq", name: "Nasdaq Composite", region: "US", yahoo: "^IXIC", twelve: "IXIC" },
  { id: "dow", name: "Dow Jones", region: "US", yahoo: "^DJI", twelve: "DJI" },
  { id: "ftse", name: "FTSE 100", region: "UK", yahoo: "^FTSE", twelve: "UKX" },
  { id: "nikkei", name: "Nikkei 225", region: "JP", yahoo: "^N225", twelve: "NI225" },
  { id: "hsi", name: "Hang Seng", region: "HK", yahoo: "^HSI", twelve: "HSI" },
  { id: "dax", name: "DAX", region: "DE", yahoo: "^GDAXI", twelve: "GDAXI" },
];

const ADRS: Spec[] = [
  { id: "infy", name: "Infosys ADR", region: "US", yahoo: "INFY", twelve: "INFY" },
  { id: "hdb", name: "HDFC Bank ADR", region: "US", yahoo: "HDB", twelve: "HDB" },
  { id: "ibn", name: "ICICI Bank ADR", region: "US", yahoo: "IBN", twelve: "IBN" },
];

const ALL = [...INDICES, ...ADRS];

const YAHOO_BASE = (process.env.YAHOO_FINANCE_BASE_URL || "https://query1.finance.yahoo.com/v8/finance/chart").replace(/\/$/, "");
const TWELVE_BASE = (process.env.TWELVE_DATA_BASE_URL || "https://api.twelvedata.com").replace(/\/$/, "");

const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json",
};

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
    }>;
    error?: { description?: string };
  };
};

async function fetchYahooBoard(): Promise<GlobalIndex[]> {
  const settled = await Promise.allSettled(
    ALL.map(async (spec) => {
      const data = await fetchJson<YahooChart>(`${YAHOO_BASE}/${encodeURIComponent(spec.yahoo)}?interval=1d&range=5d`, {
        headers: YAHOO_HEADERS,
        timeoutMs: 8_000,
      });
      const meta = data.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice);
      if (!Number.isFinite(price) || price <= 0) throw new Error(`Yahoo empty for ${spec.yahoo}`);
      const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? 0);
      const change = prev ? price - prev : 0;
      const percentChange = prev ? (change / prev) * 100 : 0;
      return {
        id: spec.id,
        name: spec.name,
        region: spec.region,
        symbol: spec.yahoo,
        price,
        change,
        percentChange,
        currency: meta?.currency || "USD",
      } satisfies GlobalIndex;
    }),
  );
  const rows = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (rows.length < 3) {
    const firstErr = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw new Error(firstErr ? String(firstErr.reason) : "Yahoo returned too few indices");
  }
  return rows;
}

type TwelveQuote = {
  symbol?: string;
  close?: string;
  change?: string;
  percent_change?: string;
  currency?: string;
};

async function fetchTwelveBoard(): Promise<GlobalIndex[]> {
  const key = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!key) throw new Error("TWELVE_DATA_API_KEY not set");
  const symbols = ALL.map((s) => s.twelve).join(",");
  const raw = await fetchJson<Record<string, TwelveQuote> | TwelveQuote>(
    `${TWELVE_BASE}/quote?symbol=${encodeURIComponent(symbols)}&apikey=${encodeURIComponent(key)}`,
    { timeoutMs: 10_000 },
  );

  const bySymbol = new Map<string, TwelveQuote>();
  if (raw && typeof raw === "object" && "close" in raw) {
    bySymbol.set(String((raw as TwelveQuote).symbol ?? ALL[0].twelve), raw as TwelveQuote);
  } else {
    for (const [sym, quote] of Object.entries(raw as Record<string, TwelveQuote>)) {
      bySymbol.set(sym.toUpperCase(), quote);
    }
  }

  const rows: GlobalIndex[] = [];
  for (const spec of ALL) {
    const q = bySymbol.get(spec.twelve.toUpperCase());
    const price = Number(q?.close);
    if (!Number.isFinite(price) || price <= 0) continue;
    rows.push({
      id: spec.id,
      name: spec.name,
      region: spec.region,
      symbol: spec.twelve,
      price,
      change: Number(q?.change ?? 0),
      percentChange: Number(q?.percent_change ?? 0),
      currency: q?.currency || "USD",
    });
  }
  if (!rows.length) throw new Error("Twelve Data returned no quotes");
  return rows;
}

let cache: { data: GlobalIndex[]; provider: string; at: number } | null = null;
const TTL = 60_000;

export async function getGlobalIndices(): Promise<{
  indices: GlobalIndex[];
  provider: string;
  stale?: boolean;
}> {
  if (cache && Date.now() - cache.at < TTL) {
    return { indices: cache.data, provider: cache.provider };
  }

  const key = process.env.TWELVE_DATA_API_KEY?.trim();
  const providers: Provider<GlobalIndex[]>[] = [
    { name: "yahoo", run: fetchYahooBoard },
    { name: "twelve-data", enabled: Boolean(key), run: fetchTwelveBoard },
  ];

  try {
    const { value, provider } = await firstSuccess(providers);
    cache = { data: value, provider, at: Date.now() };
    return { indices: value, provider };
  } catch (e) {
    if (cache) return { indices: cache.data, provider: cache.provider, stale: true };
    throw e;
  }
}
