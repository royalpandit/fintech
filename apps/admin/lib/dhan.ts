import "server-only";

import { unixSecToIsoIst } from "@/lib/nse-market-time";
import {
  formatExpiryLabel,
  optionChainExchange,
  resolveMarketExchange,
} from "@/lib/angelone-shared";
import type {
  Candle,
  CandleInterval,
  DepthLevel,
  LTPData,
  MarketDepthQuote,
  OptionChainRow,
  OptionLeg,
} from "@/lib/angelone-types";
import { scheduleAngelRest } from "@/lib/angelone-quote-coordinator";
import { getDhanAccessToken } from "@/lib/dhan-auth";

// Re-export everything routes currently import from @/lib/angelone
export {
  formatExpiryLabel,
  MARKET_INSTRUMENTS,
  optionChainExchange,
  optionUnderlyingKey,
  resolveMarketExchange,
} from "@/lib/angelone-shared";
export type { KnownSymbol } from "@/lib/angelone-shared";
export type {
  Candle,
  CandleInterval,
  DepthLevel,
  LTPData,
  MarketDepthQuote,
  OptionChainRow,
  OptionLeg,
} from "@/lib/angelone-types";

const BASE = "https://api.dhan.co/v2";

function dhanHeaders() {
  const clientId = process.env.DHAN_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("DHAN_CLIENT_ID not set in apps/admin/.env");
  }
  return {
    "Content-Type": "application/json",
    "access-token": getDhanAccessToken(),
    "client-id": clientId,
  };
}

// Map app-internal exchange codes → Dhan exchange segment strings
function toDhanSegment(exchange: string): string {
  switch (exchange.toUpperCase()) {
    case "IDX_I":       return "IDX_I";
    case "NSE":         return "NSE_EQ";
    case "BSE":         return "BSE_EQ";
    case "NFO":         return "NSE_FNO";
    case "BFO":         return "BSE_FNO";
    case "MCX":         return "MCX_COMM";
    case "CDE":         return "NSE_CURRENCY";
    // already in Dhan format — pass through
    case "NSE_EQ":      return "NSE_EQ";
    case "BSE_EQ":      return "BSE_EQ";
    case "NSE_FNO":     return "NSE_FNO";
    case "BSE_FNO":     return "BSE_FNO";
    case "MCX_COMM":    return "MCX_COMM";
    default:            return "NSE_EQ";
  }
}

// Determine Dhan instrument type for historical candle requests
function toDhanInstrument(segment: string, sym = ""): string {
  sym = sym.toUpperCase();
  if (segment === "IDX_I") return "INDEX";
  if (segment === "NSE_FNO" || segment === "BSE_FNO") {
    if (sym.endsWith("CE") || sym.endsWith("PE"))
      return /NIFTY|BANKNIFTY|SENSEX/.test(sym) ? "OPTIDX" : "OPTSTK";
    return /NIFTY|BANKNIFTY/.test(sym) ? "FUTIDX" : "FUTSTK";
  }
  if (segment === "MCX_COMM") return "FUTCOM";
  return "EQUITY";
}

// "14AUG24" → "2024-08-14" (Dhan needs ISO dates for option chain)
function toISOExpiry(code: string | undefined): string {
  if (!code) return nearestThursdayISO();
  const M: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };
  const m = code.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  return m ? `20${m[3]}-${M[m[2]] ?? "01"}-${m[1]}` : code;
}

// Returns nearest upcoming Thursday in IST as "YYYY-MM-DD"
function nearestThursdayISO(): string {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const day = ist.getUTCDay(); // 0=Sun 4=Thu
  const daysToThur = ((4 - day) + 7) % 7 || 7;
  const thu = new Date(istMs + daysToThur * 86_400_000);
  return `${thu.getUTCFullYear()}-${String(thu.getUTCMonth() + 1).padStart(2, "0")}-${String(thu.getUTCDate()).padStart(2, "0")}`;
}

// ISO "YYYY-MM-DD" → "14AUG24" app format
function isoToExpiryCode(iso: string): string {
  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const d = new Date(iso + "T00:00:00Z");
  return `${String(d.getUTCDate()).padStart(2,"0")}${MONTHS[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(2)}`;
}

// Angel One-style interval name → Dhan interval number (null = use daily endpoint)
const DHAN_INTERVAL: Record<CandleInterval, string | null> = {
  ONE_MINUTE:     "1",
  THREE_MINUTE:   "3",
  FIVE_MINUTE:    "5",
  TEN_MINUTE:     "10",
  FIFTEEN_MINUTE: "15",
  THIRTY_MINUTE:  "30",
  ONE_HOUR:       "60",
  ONE_DAY:        null,
};

// ── Security Master cache (for symbol search) ─────────────────────────────

type ScripRow = {
  securityId: string;
  tradingSymbol: string;
  symbolName: string;
  exchange: string;
  segment: string;
  instrumentType: string;
};

let _master: ScripRow[] | null = null;
let _masterFetch: Promise<ScripRow[]> | null = null;

async function fetchSecurityMaster(): Promise<ScripRow[]> {
  if (_master) return _master;
  if (_masterFetch) return _masterFetch;
  _masterFetch = (async () => {
    const res = await fetch("https://images.dhan.co/api-data/api-scrip-master.csv", {
      next: { revalidate: 86_400 },
    });
    const text = await res.text();
    const lines = text.split("\n");
    const hdr = lines[0].split(",");
    const col = (name: string) => hdr.indexOf(name);
    const ID   = col("SEM_SMST_SECURITY_ID");
    const SYM  = col("SEM_TRADING_SYMBOL");
    const NAME = col("SEM_CUSTOM_SYMBOL");
    const EXCH = col("SEM_EXM_EXCH_ID");
    const SEG  = col("SEM_SEGMENT");
    const INST = col("SEM_INSTRUMENT_NAME");
    const rows: ScripRow[] = [];
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const c = line.split(",");
      rows.push({
        securityId:   c[ID]?.trim()   ?? "",
        tradingSymbol: c[SYM]?.trim() ?? "",
        symbolName:   c[NAME]?.trim() ?? c[SYM]?.trim() ?? "",
        exchange:     c[EXCH]?.trim() ?? "NSE",
        segment:      c[SEG]?.trim()  ?? "E",
        instrumentType: c[INST]?.trim() ?? "EQUITY",
      });
    }
    _master = rows;
    return rows;
  })();
  return _masterFetch;
}

export type SearchResult = {
  exchange: string;
  tradingSymbol: string;
  symbolName: string;
  instrumentType: string;
  token: string;
};

export async function searchSymbol(exchange: string, query: string): Promise<SearchResult[]> {
  const q = query.toUpperCase().trim();
  if (!q) return [];
  const master = await fetchSecurityMaster();
  const exch = exchange.toUpperCase();
  const results: SearchResult[] = [];
  for (const row of master) {
    if (exch !== "ALL" && row.exchange.toUpperCase() !== exch) continue;
    // Only equity/index rows — skip the F&O noise
    if (row.segment !== "E" && row.segment !== "D" && row.segment !== "I") continue;
    if (!row.tradingSymbol.toUpperCase().includes(q) && !row.symbolName.toUpperCase().includes(q)) continue;
    results.push({
      exchange: row.exchange,
      tradingSymbol: row.tradingSymbol,
      symbolName: row.symbolName,
      instrumentType: row.instrumentType,
      token: row.securityId,
    });
    if (results.length >= 20) break;
  }
  return results;
}

// ── Market Feed (quotes) ──────────────────────────────────────────────────

export type QuoteInstrument = {
  exchange: string;
  symboltoken: string;
  tradingSymbol?: string;
  instrumentType?: string;
};

type DhanEntry = {
  last_price?: number;
  ltp?: number;
  ohlc?: { open?: number; high?: number; low?: number; close?: number };
  net_change?: number;
  percentage_change?: number;
  volume?: number;
  trade_volume?: number;
  oi?: number;
  average_price?: number;
  week_52_high?: number;
  week_52_low?: number;
  oi_day_high?: number;
  oi_day_low?: number;
  total_buy_quantity?: number;
  total_sell_quantity?: number;
  depth?: { buy?: DhanDepthLevel[]; sell?: DhanDepthLevel[] };
};

type DhanDepthLevel = { price?: number; quantity?: number; orders?: number };

function mapEntry(seg: string, secId: string, e: DhanEntry, sym?: string): LTPData {
  const ltp    = e.last_price ?? e.ltp ?? 0;
  const close  = e.ohlc?.close ?? ltp;
  const net    = e.net_change ?? (ltp - close);
  const pct    = e.percentage_change ?? (close ? (net / close) * 100 : 0);
  return {
    exchange:     seg,
    tradingSymbol: sym ?? secId,
    symbolToken:  secId,
    open:   e.ohlc?.open  ?? 0,
    high:   e.ohlc?.high  ?? 0,
    low:    e.ohlc?.low   ?? 0,
    close,
    ltp,
    netChange:     net,
    percentChange: pct,
  };
}

function buildPayload(instruments: { exchange: string; symboltoken: string }[]): Record<string, number[]> {
  const payload: Record<string, number[]> = {};
  for (const i of instruments) {
    const seg = toDhanSegment(i.exchange);
    (payload[seg] ||= []).push(Number(i.symboltoken));
  }
  return payload;
}

async function dhanPost<T>(path: string, body: unknown): Promise<T> {
  console.log(`[Dhan] POST ${path}`, JSON.stringify(body).slice(0, 300));
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: dhanHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json() as T & { remarks?: string; errorCode?: string; status?: string };
  console.log(`[Dhan] ${path} → HTTP ${res.status}`, JSON.stringify(json).slice(0, 500));
  if (!res.ok) {
    const msg = (json as Record<string, unknown>).remarks ?? (json as Record<string, unknown>).errorCode ?? res.statusText;
    throw new Error(`Dhan ${path} → HTTP ${res.status}: ${msg}`);
  }
  return json;
}

type DhanFeedResponse = {
  status: string;
  data?: Record<string, Record<string, DhanEntry>>;
};

function extractQuotes(json: DhanFeedResponse, sym?: (seg: string, id: string) => string): LTPData[] {
  if (json.status !== "success" || !json.data) return [];
  const out: LTPData[] = [];
  for (const [seg, entries] of Object.entries(json.data)) {
    for (const [secId, entry] of Object.entries(entries)) {
      out.push(mapEntry(seg, secId, entry, sym?.(seg, secId)));
    }
  }
  return out;
}

export async function getLTP(instruments: QuoteInstrument[]): Promise<LTPData[]> {
  if (!instruments.length) return [];
  const payload = buildPayload(instruments);
  return scheduleAngelRest("dhan-ltp", async () => {
    const json = await dhanPost<DhanFeedResponse>("/marketfeed/ltp", payload);
    if (json.status !== "success") { console.warn("[Dhan] getLTP:", json); return []; }
    return extractQuotes(json);
  });
}

export async function getOHLC(instruments: { exchange: string; symboltoken: string }[]): Promise<LTPData[]> {
  if (!instruments.length) return [];
  const payload = buildPayload(instruments);
  return scheduleAngelRest("dhan-ohlc", async () => {
    const json = await dhanPost<DhanFeedResponse>("/marketfeed/ohlc", payload);
    return extractQuotes(json);
  });
}

export type ExtendedQuoteData = LTPData & {
  tradeVolume?: number;
  opnInterest?: number;
  week52High?: number;
  week52Low?: number;
};

export async function getExtendedQuotes(instruments: QuoteInstrument[]): Promise<ExtendedQuoteData[]> {
  if (!instruments.length) return [];
  const payload = buildPayload(instruments);
  return scheduleAngelRest("dhan-quote", async () => {
    const json = await dhanPost<DhanFeedResponse>("/marketfeed/quote", payload);
    if (json.status !== "success" || !json.data) return [];
    const out: ExtendedQuoteData[] = [];
    for (const [seg, entries] of Object.entries(json.data)) {
      for (const [secId, e] of Object.entries(entries)) {
        out.push({
          ...mapEntry(seg, secId, e),
          tradeVolume:  e.trade_volume ?? e.volume,
          opnInterest:  e.oi,
          week52High:   e.week_52_high,
          week52Low:    e.week_52_low,
        });
      }
    }
    return out;
  });
}

export async function getMarketDepth(
  exchange: string,
  token: string,
  tradingSymbol: string,
): Promise<MarketDepthQuote> {
  const seg = toDhanSegment(exchange);
  return scheduleAngelRest("dhan-depth", async () => {
    const json = await dhanPost<DhanFeedResponse>("/marketfeed/quote", { [seg]: [Number(token)] });
    if (json.status !== "success" || !json.data) throw new Error("Dhan depth failed");
    const e = json.data[seg]?.[token];
    if (!e) throw new Error(`No depth data for ${seg}:${token}`);
    const base = mapEntry(seg, token, e, tradingSymbol);
    const mapLevels = (arr?: DhanDepthLevel[]): DepthLevel[] =>
      (arr ?? []).slice(0, 5).map(d => ({ price: d.price ?? 0, quantity: d.quantity ?? 0, orders: d.orders ?? 0 }));
    return {
      ...base,
      token,
      tradingSymbol,
      avgPrice:     e.average_price,
      tradeVolume:  e.trade_volume ?? e.volume,
      buy:          mapLevels(e.depth?.buy),
      sell:         mapLevels(e.depth?.sell),
      totalBuyQty:  e.total_buy_quantity ?? 0,
      totalSellQty: e.total_sell_quantity ?? 0,
    };
  });
}

// ── Historical Candles ────────────────────────────────────────────────────

export async function getCandles(params: {
  exchange: string;
  symboltoken: string;
  interval: CandleInterval;
  tradingSymbol?: string;
  instrumentType?: string;
  fromDate?: string;
  toDate?: string;
  fromdate?: string;
  todate?: string;
}): Promise<Candle[]> {
  const seg      = toDhanSegment(params.exchange);
  const intv     = DHAN_INTERVAL[params.interval];
  const intraday = intv !== null;
  const endpoint = intraday ? "/charts/intraday" : "/charts/historical";
  const instrument = toDhanInstrument(seg, params.tradingSymbol ?? params.instrumentType);

  // Dhan expects "YYYY-MM-DD" only — strip any time component
  const stripTime = (dt: string) => dt.split(" ")[0];
  const fromDate = stripTime(params.fromDate ?? params.fromdate ?? "");
  const toDate   = stripTime(params.toDate   ?? params.todate   ?? "");

  const body: Record<string, unknown> = {
    securityId:      params.symboltoken,
    exchangeSegment: seg,
    instrument,
    fromDate,
    toDate,
  };
  if (intraday) body.interval = intv;
  else body.expiryCode = 0;

  return scheduleAngelRest("dhan-candles", async () => {
    // Dhan response uses start_Time (Unix seconds) not timestamp
    type CandleResp = { open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[]; start_Time?: number[]; timestamp?: number[] };
    const json = await dhanPost<CandleResp>(endpoint, body);
    const times = json.start_Time ?? json.timestamp;
    if (!times?.length) return [];
    return times.map((ts, i) => ({
      timestamp: unixSecToIsoIst(ts),
      open:   json.open?.[i]   ?? 0,
      high:   json.high?.[i]   ?? 0,
      low:    json.low?.[i]    ?? 0,
      close:  json.close?.[i]  ?? 0,
      volume: json.volume?.[i] ?? 0,
    }));
  });
}

// ── Portfolio ─────────────────────────────────────────────────────────────

// Field names kept compatible with Angel One so existing route/UI code works
export interface Holding {
  tradingsymbol: string;
  exchange: string;
  symboltoken: string;
  isin: string;
  quantity: number;
  averageprice: number;
  ltp: number;
  close: number;
  profitandloss: number;
  pnlpercentage: number;
  symbolname: string;
}

export async function getHoldings(): Promise<Holding[]> {
  const res = await fetch(`${BASE}/portfolio/holdings`, {
    headers: dhanHeaders(),
    cache: "no-store",
  });
  const json = await res.json() as { data?: Array<Record<string, unknown>> };
  if (!Array.isArray(json.data)) return [];
  return json.data.map(h => {
    const qty  = Number(h.totalQty ?? h.dpQty ?? 0);
    const avg  = Number(h.avgCostPrice ?? 0);
    const ltp  = Number(h.lastTradedPrice ?? 0);
    const close = Number(h.closingPrice ?? ltp);
    const pnl  = (ltp - avg) * qty;
    const pnlPct = avg > 0 ? (pnl / (avg * qty)) * 100 : 0;
    return {
      tradingsymbol:  String(h.tradingSymbol ?? ""),
      exchange:       String(h.exchange ?? "NSE"),
      symboltoken:    String(h.securityId ?? ""),
      isin:           String(h.isin ?? ""),
      quantity:       qty,
      averageprice:   avg,
      ltp,
      close,
      profitandloss:  pnl,
      pnlpercentage:  pnlPct,
      symbolname:     String(h.tradingSymbol ?? ""),
    };
  });
}

export interface Position {
  tradingsymbol: string;
  exchange: string;
  producttype: string;
  buyqty: number;
  sellqty: number;
  netqty: number;
  avgnetprice: number;
  ltp: number;
  unrealised: number;
  realised: number;
  pnl: number;
}

export async function getPositions(): Promise<Position[]> {
  const res = await fetch(`${BASE}/portfolio/positions`, {
    headers: dhanHeaders(),
    cache: "no-store",
  });
  const json = await res.json() as { data?: Array<Record<string, unknown>> };
  if (!Array.isArray(json.data)) return [];
  return json.data.map(p => {
    const unreal = Number(p.unrealizedProfit ?? 0);
    const real   = Number(p.realizedProfit   ?? 0);
    return {
      tradingsymbol: String(p.tradingSymbol   ?? ""),
      exchange:      String(p.exchangeSegment ?? "NSE_EQ"),
      producttype:   String(p.productType     ?? "CNC"),
      buyqty:        Number(p.buyQty   ?? 0),
      sellqty:       Number(p.sellQty  ?? 0),
      netqty:        Number(p.netQty   ?? 0),
      avgnetprice:   Number(p.costPrice ?? p.buyAvg ?? 0),
      ltp:           Number(p.ltp ?? 0),
      unrealised:    unreal,
      realised:      real,
      pnl:           unreal + real,
    };
  });
}

// ── Option Chain ──────────────────────────────────────────────────────────

// Underlying → Dhan securityId + exchange segment
const UNDERLYING_META: Record<string, { secId: string; seg: string }> = {
  NIFTY:      { secId: "13", seg: "IDX_I" },
  BANKNIFTY:  { secId: "25", seg: "IDX_I" },
  SENSEX:     { secId: "51", seg: "IDX_I" },
  FINNIFTY:   { secId: "27", seg: "IDX_I" },
  MIDCPNIFTY: { secId: "11", seg: "IDX_I" },
};

export type OptionChainResult = {
  underlying: string;
  exchange: string;
  expiry: string;
  expiries: { code: string; label: string }[];
  spot: number;
  rows: OptionChainRow[];
  tokens: { token: string; exchange: string }[];
};

export async function getOptionChain(
  underlying: string,
  spot: number | undefined,
  expiryCode?: string,
  opts: { profile?: boolean } = {},
): Promise<OptionChainResult> {
  const key = underlying.toUpperCase().replace(/[\s-]/g, "");
  const meta = UNDERLYING_META[key];
  if (!meta) throw new Error(`Unknown underlying for option chain: ${underlying}`);

  const expiryISO = toISOExpiry(expiryCode);
  const resolvedCode = expiryCode || isoToExpiryCode(expiryISO);
  const url = `${BASE}/optionchain?UnderlyingScrip=${meta.secId}&UnderlyingSeg=${meta.seg}&Expiry=${expiryISO}`;

  console.log(`[Dhan] getOptionChain key=${key} expiry=${expiryISO} url=${url}`);

  return scheduleAngelRest("dhan-optchain", async () => {
    const res = await fetch(url, { headers: dhanHeaders(), cache: "no-store" });
    const json = await res.json() as {
      status?: string;
      remarks?: string;
      data?: {
        oc?: Array<{
          strike_price?: number;
          call_options?: { security_id?: string; ltp?: number; volume?: number; oi?: number; oi_change?: number; net_change?: number };
          put_options?:  { security_id?: string; ltp?: number; volume?: number; oi?: number; oi_change?: number; net_change?: number };
        }>;
        underlying_ltp?: number;
        expiry_list?: string[];
      };
    };
    console.log(`[Dhan] optionchain HTTP ${res.status}`, JSON.stringify(json).slice(0, 400));

    if (!res.ok) throw new Error(`Dhan option chain HTTP ${res.status}: ${json.remarks ?? res.statusText}`);
    const data = json.data;
    if (!data?.oc) throw new Error(`Dhan option chain returned no data. Response: ${JSON.stringify(json).slice(0, 200)}`);

    const liveSpot = data.underlying_ltp ?? spot ?? 0;
    const stepSize = key === "SENSEX" ? 100 : 50;
    const atmStrike = Math.round(liveSpot / stepSize) * stepSize;
    const radius    = opts.profile ? 35 : 15;
    const rows: OptionChainRow[] = [];
    const tokenSet = new Set<string>();

    for (const item of data.oc) {
      const strike = item.strike_price ?? 0;
      if (liveSpot > 0 && Math.abs(strike - atmStrike) > radius * stepSize) continue;

      const mapLeg = (side: typeof item.call_options, type: "CE" | "PE"): OptionLeg | undefined => {
        if (!side) return undefined;
        const token = side.security_id ?? `${meta.secId}_${strike}_${type}`;
        if (side.security_id) tokenSet.add(side.security_id);
        return {
          tradingsymbol: `${key}${resolvedCode}${strike}${type}`,
          token,
          ltp:      side.ltp,
          change:   side.net_change,
          oi:       side.oi,
          oiChange: side.oi_change,
          volume:   side.volume,
        };
      };
      rows.push({ strike, ce: mapLeg(item.call_options, "CE"), pe: mapLeg(item.put_options, "PE") });
    }

    const expiries = (data.expiry_list ?? [expiryISO]).map(iso => ({
      code: isoToExpiryCode(iso),
      label: formatExpiryLabel(isoToExpiryCode(iso)),
    }));

    const tokens = [...tokenSet].map(t => ({ token: t, exchange: meta.seg }));

    return {
      underlying: key,
      exchange: meta.seg,
      expiry: resolvedCode,
      expiries,
      spot: liveSpot,
      rows,
      tokens,
    };
  });
}

export async function refreshOptionChainQuotes(
  exchange: string,
  tokens: string[],
): Promise<Record<string, {
  ltp: number;
  netChange: number;
  percentChange: number;
  tradeVolume?: number;
  opnInterest?: number;
  oiChange?: number;
  oiChangePct?: number;
}>> {
  if (!tokens.length) return {};
  const seg = toDhanSegment(exchange);
  // Token format from getOptionChain: "secId_strike_type" — extract the secId
  const secIds = [...new Set(tokens.map(t => Number(t.split("_")[0])).filter(n => !isNaN(n) && n > 0))];
  if (!secIds.length) return {};

  const json = await dhanPost<DhanFeedResponse>("/marketfeed/quote", { [seg]: secIds });
  if (json.status !== "success" || !json.data) return {};

  const out: ReturnType<typeof refreshOptionChainQuotes> extends Promise<infer T> ? T : never = {};
  for (const [, entries] of Object.entries(json.data)) {
    for (const [secId, e] of Object.entries(entries)) {
      const ltp   = e.last_price ?? e.ltp ?? 0;
      const close = e.ohlc?.close ?? ltp;
      const net   = e.net_change ?? 0;
      const pct   = e.percentage_change ?? (close ? (net / close) * 100 : 0);
      out[secId]  = { ltp, netChange: net, percentChange: pct, tradeVolume: e.trade_volume ?? e.volume, opnInterest: e.oi };
    }
  }
  return out;
}
