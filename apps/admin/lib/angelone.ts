import crypto from "crypto";
import { normalizeCandleTimestamp } from "@/lib/nse-market-time";

const BASE_URL = "https://apiconnect.angelone.in";

function base32Decode(encoded: string): Buffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = encoded.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of cleaned) {
    const idx = chars.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function generateTOTP(secret: string, windowOffset = 0): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + windowOffset;
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[19] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

interface TokenCache {
  jwtToken: string;
  feedToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Module-level cache (lives for the Node.js process lifetime)
let _cache: TokenCache | null = null;
// Deduplicate concurrent login calls — prevents TOTP replay rejection
let _loginPromise: Promise<TokenCache> | null = null;

function clientPublicIp() {
  return process.env.ANGELONE_CLIENT_PUBLIC_IP?.trim() || "106.193.147.98";
}

function commonHeaders(jwt: string, feed: string) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${jwt}`,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "192.168.1.1",
    "X-ClientPublicIP": clientPublicIp(),
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": process.env.ANGELONE_API_KEY!,
    "X-ClientCode": process.env.ANGELONE_CLIENT_CODE!,
    "X-FeedToken": feed,
  };
}

const SEARCH_SCRIP_PATH = "/rest/secure/angelbroking/order/v1/searchScrip";

async function login(): Promise<TokenCache> {
  let lastError = "Authentication failed";
  // Try current window then adjacent windows to handle clock drift
  for (const offset of [0, -1, 1]) {
    const totp = generateTOTP(process.env.ANGELONE_TOTP_SECRET!, offset);
    const res = await fetch(
      `${BASE_URL}/rest/auth/angelbroking/user/v1/loginByPassword`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "192.168.1.1",
          "X-ClientPublicIP": clientPublicIp(),
          "X-MACAddress": "00:00:00:00:00:00",
          "X-PrivateKey": process.env.ANGELONE_API_KEY!,
        },
        body: JSON.stringify({
          clientcode: process.env.ANGELONE_CLIENT_CODE,
          password: process.env.ANGELONE_MPIN,
          totp,
        }),
      }
    );
    const data = await res.json();
    console.log("[AngelOne] login attempt offset=%d status=%s msg=%s", offset, data.status, data.message);
    if (data.status && data.data?.jwtToken) {
      const token: TokenCache = {
        jwtToken: data.data.jwtToken,
        feedToken: data.data.feedToken,
        refreshToken: data.data.refreshToken,
        // Angel One tokens expire daily; cache for 5 hours to be safe
        expiresAt: Date.now() + 5 * 60 * 60 * 1000,
      };
      _cache = token;
      return token;
    }
    lastError = data.message ?? lastError;
  }
  throw new Error(`Angel One login failed: ${lastError}`);
}

export async function getToken(): Promise<TokenCache> {
  if (_cache && _cache.expiresAt > Date.now() + 60_000) return _cache;
  // If a login is already in flight, wait for it instead of starting another
  // (avoids sending the same TOTP twice — Angel One rejects replays)
  if (!_loginPromise) {
    _loginPromise = login().finally(() => {
      _loginPromise = null;
    });
  }
  return _loginPromise;
}

// ── Market Data ──────────────────────────────────────────────────────────────

type AngelJson = {
  status?: boolean;
  message?: string;
  errorcode?: string;
  data?: unknown;
};

async function parseAngelJson(res: Response): Promise<AngelJson> {
  const text = await res.text();
  try {
    return JSON.parse(text) as AngelJson;
  } catch {
    throw new Error(text.slice(0, 120) || `Angel One API error (${res.status})`);
  }
}

function angelError(data: AngelJson, fallback: string): string {
  return (data.message || data.errorcode || fallback).trim();
}

/** SmartAPI requires token + exchange to match scrip master — normalize before quotes/candles */
export function resolveMarketExchange(input: {
  exchange: string;
  symboltoken: string;
  tradingSymbol?: string;
  instrumentType?: string;
}): string {
  const sym = (input.tradingSymbol ?? "").toUpperCase();
  const exch = (input.exchange ?? "NSE").toUpperCase();
  if (sym.endsWith("-EQ") || sym.endsWith("-BE") || input.instrumentType === "EQ") {
    if (exch === "BSE" || input.symboltoken === "99919000" || sym.includes("SENSEX")) return "BSE";
    return "NSE";
  }
  if (sym.endsWith("CE") || sym.endsWith("PE") || input.instrumentType === "OPT") return "NFO";
  if (sym.includes("FUT") || input.instrumentType === "FUT") return "NFO";
  if (input.symboltoken === "99919000" || sym.includes("SENSEX")) return "BSE";
  if (exch === "BSE") return "BSE";
  if (exch === "MCX" || exch === "NCDEX") return exch;
  return "NSE";
}

export function optionChainExchange(underlying: string): string {
  return underlying.toUpperCase() === "SENSEX" ? "BFO" : "NFO";
}

export interface LTPData {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ltp: number;
  percentChange: number;
  netChange: number;
}

export type QuoteInstrument = {
  exchange: string;
  symboltoken: string;
  tradingSymbol?: string;
  instrumentType?: string;
};

/** Fetch Last Traded Price for a list of instruments. */
export async function getLTP(instruments: QuoteInstrument[]): Promise<LTPData[]> {
  if (!instruments.length) return [];
  const { jwtToken, feedToken } = await getToken();
  const normalized = instruments.map(i => ({
    exchange: resolveMarketExchange({
      exchange: i.exchange,
      symboltoken: i.symboltoken,
      tradingSymbol: i.tradingSymbol,
      instrumentType: i.instrumentType,
    }),
    symboltoken: i.symboltoken,
  }));
  const exchangeTokens = normalized.reduce<Record<string, string[]>>(
    (acc, inst) => {
      (acc[inst.exchange] ||= []).push(inst.symboltoken);
      return acc;
    },
    {}
  );
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/market/v1/quote/`,
    {
      method: "POST",
      headers: commonHeaders(jwtToken, feedToken),
      body: JSON.stringify({ mode: "LTP", exchangeTokens }),
      next: { revalidate: 0 },
    }
  );
  const data = await parseAngelJson(res);
  if (!data.status) {
    const msg = angelError(data, "Quote failed");
    console.warn("[AngelOne] getLTP:", msg);
    const { handleRateLimitMessage } = await import("./market-rate-limit");
    handleRateLimitMessage(msg);
    throw new Error(msg);
  }
  return (data.data as { fetched?: LTPData[] })?.fetched ?? [];
}

/** Fetch OHLC quote for a list of instruments. */
export async function getOHLC(
  instruments: { exchange: string; symboltoken: string }[]
): Promise<LTPData[]> {
  const { jwtToken, feedToken } = await getToken();
  const exchangeTokens = instruments.reduce<Record<string, string[]>>(
    (acc, inst) => {
      (acc[inst.exchange] ||= []).push(inst.symboltoken);
      return acc;
    },
    {}
  );
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/market/v1/quote/`,
    {
      method: "POST",
      headers: commonHeaders(jwtToken, feedToken),
      body: JSON.stringify({ mode: "OHLC", exchangeTokens }),
      next: { revalidate: 0 },
    }
  );
  const data = await res.json();
  return data.data?.fetched ?? [];
}

export type CandleInterval =
  | "ONE_MINUTE"
  | "THREE_MINUTE"
  | "FIVE_MINUTE"
  | "TEN_MINUTE"
  | "FIFTEEN_MINUTE"
  | "THIRTY_MINUTE"
  | "ONE_HOUR"
  | "ONE_DAY";

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Fetch historical OHLCV candle data. fromdate/todate format: "YYYY-MM-DD HH:MM" */
export async function getCandles(params: {
  exchange: string;
  symboltoken: string;
  tradingSymbol?: string;
  instrumentType?: string;
  interval: CandleInterval;
  fromdate: string;
  todate: string;
}): Promise<Candle[]> {
  const { jwtToken, feedToken } = await getToken();
  const primary = resolveMarketExchange(params);
  const fallbacks =
    primary === "BSE" ? ["NSE"] : primary === "NSE" && params.symboltoken === "99919000" ? ["BSE"] : [];

  const exchanges = [primary, ...fallbacks];
  let lastError = "Candle data failed";

  for (const exchange of exchanges) {
    const res = await fetch(
      `${BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData`,
      {
        method: "POST",
        headers: commonHeaders(jwtToken, feedToken),
        body: JSON.stringify({
          exchange,
          symboltoken: params.symboltoken,
          interval: params.interval,
          fromdate: params.fromdate,
          todate: params.todate,
        }),
        next: { revalidate: 0 },
      }
    );
    const data = await parseAngelJson(res);
    if (!data.status) {
      lastError = angelError(data, lastError);
      if (lastError.toLowerCase().includes("scrip not found") && fallbacks.length) continue;
      throw new Error(lastError);
    }
    const raw: [string, number, number, number, number, number][] =
      (data.data as [string, number, number, number, number, number][]) ?? [];
    return raw
      .map(([timestamp, open, high, low, close, volume]) => ({
        timestamp: normalizeCandleTimestamp(String(timestamp)),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Math.max(0, Number(volume) || 0),
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  throw new Error(lastError);
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

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
  const { jwtToken, feedToken } = await getToken();
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/portfolio/v1/getAllHolding`,
    {
      method: "GET",
      headers: commonHeaders(jwtToken, feedToken),
      next: { revalidate: 0 },
    }
  );
  const data = await res.json();
  return data.data?.holdings ?? [];
}

export interface Position {
  symbolname: string;
  tradingsymbol: string;
  exchange: string;
  symboltoken: string;
  producttype: string;
  cfbuyqty: number;
  cfsellqty: number;
  netqty: number;
  avgnetprice: number;
  ltp: number;
  unrealised: number;
  realised: number;
  pnl: number;
}

export async function getPositions(): Promise<Position[]> {
  const { jwtToken, feedToken } = await getToken();
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/order/v1/getPosition`,
    {
      method: "GET",
      headers: commonHeaders(jwtToken, feedToken),
      next: { revalidate: 0 },
    }
  );
  const data = await res.json();
  return data.data ?? [];
}

// ── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  exchange: string;
  tradingSymbol: string;
  symbolName: string;
  instrumentType: string;
  token: string;
}

function inferInstrumentType(tradingSymbol: string, exchange: string): string {
  const sym = tradingSymbol.toUpperCase();
  if (sym.endsWith("-EQ") || sym.endsWith("-BE") || sym.endsWith("-BL")) return "EQ";
  if (sym.endsWith("CE") || sym.endsWith("PE")) return "OPT";
  if (sym.includes("FUT")) return "FUT";
  if (exchange === "NSE" && /^(999\d+|1\d{4})$/.test(sym)) return "INDEX";
  if (exchange === "BSE" && sym.startsWith("SENSEX")) return "INDEX";
  return "EQ";
}

function mapSearchRow(d: Record<string, string>, exch: string): SearchResult | null {
  const tradingSymbol = (d.tradingsymbol ?? d.trading_symbol ?? "").trim();
  const token = String(d.symboltoken ?? d.token ?? "").trim();
  if (!tradingSymbol || !token) return null;
  const exchange = d.exchange ?? exch;
  const instrumentType = d.instrumenttype ?? d.instrument_type ?? inferInstrumentType(tradingSymbol, exchange);
  const baseName = tradingSymbol.replace(/-EQ$|-BE$|-BL$|-AF$|-IQ$|-RL$/i, "");
  return {
    exchange,
    tradingSymbol,
    symbolName: d.symbol_name ?? d.name ?? baseName,
    instrumentType,
    token,
  };
}

const ILLIQUID_SUFFIX = /-(AF|BE|BL|IQ|RL|IL)$/i;

function rankSearchResults(results: SearchResult[], query: string): SearchResult[] {
  const q = query.trim().toUpperCase();
  const score = (r: SearchResult) => {
    const sym = r.tradingSymbol.toUpperCase();
    let s = 0;
    if (sym === q) s += 120;
    if (sym === `${q}-EQ`) s += 110;
    if (sym.startsWith(q)) s += 60;
    if (sym.includes(q)) s += 30;
    if (sym.endsWith("-EQ")) s += 40;
    if (r.instrumentType === "EQ") s += 25;
    if (r.exchange === "NSE") s += 15;
    if (r.instrumentType === "OPT") s -= 5;
    if (ILLIQUID_SUFFIX.test(sym) && !q.includes("-")) s -= 80;
    return s;
  };
  const ranked = [...results].sort((a, b) => score(b) - score(a));
  const liquid = ranked.filter(r => !ILLIQUID_SUFFIX.test(r.tradingSymbol) || q.includes("-"));
  return (liquid.length ? liquid : ranked).slice(0, 50);
}

/** SmartAPI Search Scrip — https://smartapi.angelbroking.com/docs */
export async function searchSymbol(exchange: string, query: string): Promise<SearchResult[]> {
  const { jwtToken, feedToken } = await getToken();
  const q = query.trim();
  if (!q) return [];

  const searchOne = async (exch: string): Promise<SearchResult[]> => {
    try {
      const res = await fetch(`${BASE_URL}${SEARCH_SCRIP_PATH}`, {
        method: "POST",
        headers: commonHeaders(jwtToken, feedToken),
        body: JSON.stringify({ exchange: exch, searchscrip: q }),
        cache: "no-store",
      });
      const data = await parseAngelJson(res);
      if (!data.status) {
        const msg = angelError(data, "Search failed");
        if (!msg.toLowerCase().includes("scrip not found")) {
          console.warn("[AngelOne] searchScrip %s failed: %s", exch, msg);
        }
        return [];
      }
      return ((data.data as Record<string, string>[]) ?? [])
        .map((row) => mapSearchRow(row, exch))
        .filter((r: SearchResult | null): r is SearchResult => r !== null);
    } catch (err) {
      console.warn("[AngelOne] searchScrip %s error", exch, err);
      return [];
    }
  };

  // NSE + NFO cover equities, indices, and derivatives; BSE/MCX often return scrip-cache errors for partial queries
  const exchanges =
    exchange === "ALL" ? ["NSE", "NFO"] : exchange === "BSE" ? ["BSE", "NFO"] : [exchange];
  const merged: SearchResult[] = [];
  const seen = new Set<string>();
  for (const exch of exchanges) {
    const batch = await searchOne(exch);
    for (const r of batch) {
      const key = `${r.exchange}:${r.token}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
  }
  return rankSearchResults(merged, q);
}

/** Map watchlist symbol → NFO underlying search key for option chain */
export function optionUnderlyingKey(tradingSymbol: string, display: string): string | null {
  const sym = tradingSymbol.toUpperCase();
  const name = display.toUpperCase();
  if (sym.endsWith("CE") || sym.endsWith("PE")) return null;
  if (name.includes("BANK") && (name.includes("NIFTY") || sym.includes("BANKNIFTY"))) return "BANKNIFTY";
  if (name.includes("NIFTY 50") || sym === "NIFTY 50" || sym === "NIFTY") return "NIFTY";
  if (name.includes("SENSEX") || sym.includes("SENSEX")) return "SENSEX";
  if (sym.endsWith("-EQ")) return sym.replace(/-EQ$/, "");
  return sym.split("-")[0] || null;
}

export interface OptionLeg {
  tradingsymbol: string;
  token: string;
  ltp?: number;
  change?: number;
  changePct?: number;
  oi?: number;
  oiChange?: number;
  oiChangePct?: number;
  volume?: number;
}

export interface OptionChainRow {
  strike: number;
  ce?: OptionLeg;
  pe?: OptionLeg;
}

export interface OptionChainExpiry {
  code: string;
  label: string;
}

export interface OptionChainResult {
  underlying: string;
  exchange: string;
  expiry: string;
  expiries: OptionChainExpiry[];
  spot?: number;
  spotChange?: number;
  spotChangePct?: number;
  rows: OptionChainRow[];
  /** Flat list for live refresh */
  tokens: { token: string; exchange: string }[];
}

export interface ExtendedQuote extends LTPData {
  tradeVolume?: number;
  opnInterest?: number;
  opnInterestChange?: number;
  opnInterestChangePct?: number;
}

export function formatExpiryLabel(code: string): string {
  const m = code.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if (!m) return code;
  return `${m[1]} ${m[2]} 20${m[3]}`;
}

export interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface MarketDepthQuote {
  tradingSymbol: string;
  token: string;
  exchange: string;
  ltp: number;
  netChange: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  close: number;
  avgPrice?: number;
  tradeVolume?: number;
  buy: DepthLevel[];
  sell: DepthLevel[];
  totalBuyQty: number;
  totalSellQty: number;
}

function mapDepthLevels(arr: unknown): DepthLevel[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(row => {
    const r = row as Record<string, unknown>;
    return {
      price: Number(r.price) || 0,
      quantity: Number(r.quantity) || 0,
      orders: Number(r.orders) || 0,
    };
  }).filter(l => l.price > 0);
}

/** Market depth (best 5) + quote stats via FULL mode */
export async function getMarketDepth(
  exchange: string,
  token: string,
  tradingSymbol?: string
): Promise<MarketDepthQuote | null> {
  const { jwtToken, feedToken } = await getToken();
  const exch = exchange.toUpperCase();
  const rows = await fetchQuoteChunk(jwtToken, feedToken, exch, [token], "FULL");
  const raw = rows[0];
  if (!raw) return null;

  const q = mapExtendedQuote(raw);
  const depth = raw.depth as { buy?: unknown; sell?: unknown } | undefined;
  const buy = mapDepthLevels(depth?.buy);
  const sell = mapDepthLevels(depth?.sell);
  const totalBuyQty = buy.reduce((s, l) => s + l.quantity, 0);
  const totalSellQty = sell.reduce((s, l) => s + l.quantity, 0);

  return {
    tradingSymbol: tradingSymbol ?? q.tradingSymbol,
    token: q.symbolToken || token,
    exchange: exch,
    ltp: q.ltp,
    netChange: q.netChange,
    percentChange: q.percentChange,
    open: q.open,
    high: q.high,
    low: q.low,
    close: q.close,
    avgPrice: Number(raw.avgPrice) || undefined,
    tradeVolume: q.tradeVolume,
    buy,
    sell,
    totalBuyQty,
    totalSellQty,
  };
}

function parseOptionSymbol(tradingsymbol: string) {
  const m = tradingsymbol.match(/^(.+?)(\d{2}[A-Z]{3}\d{2})(\d+)(CE|PE)$/);
  if (!m) return null;
  return {
    underlying: m[1],
    expiry: m[2],
    strike: Number(m[3]),
    side: m[4] as "CE" | "PE",
    tradingsymbol,
  };
}

function mapExtendedQuote(raw: Record<string, unknown>): ExtendedQuote {
  const num = (...keys: string[]) => {
    for (const k of keys) {
      const v = raw[k];
      if (v === undefined || v === null || v === "") continue;
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };
  const oi = num("opnInterest", "openInterest", "oi");
  const vol = num("tradeVolume", "volume", "tradevolume");
  return {
    exchange: String(raw.exchange ?? ""),
    tradingSymbol: String(raw.tradingsymbol ?? raw.tradingSymbol ?? ""),
    symbolToken: String(raw.symboltoken ?? raw.symbolToken ?? ""),
    open: num("open") ?? 0,
    high: num("high") ?? 0,
    low: num("low") ?? 0,
    close: num("close") ?? 0,
    ltp: num("ltp") ?? 0,
    percentChange: num("percentChange", "change") ?? 0,
    netChange: num("netChange", "change") ?? 0,
    tradeVolume: vol,
    opnInterest: oi,
    opnInterestChange: num("opnInterestChange", "oiChange"),
    opnInterestChangePct: num("opnInterestChangePct", "oiChangePct"),
  };
}

async function fetchQuoteChunk(
  jwtToken: string,
  feedToken: string,
  exch: string,
  chunk: string[],
  mode: "FULL" | "OHLC" | "LTP"
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE_URL}/rest/secure/angelbroking/market/v1/quote/`, {
    method: "POST",
    headers: commonHeaders(jwtToken, feedToken),
    body: JSON.stringify({ mode, exchangeTokens: { [exch]: chunk } }),
    cache: "no-store",
  });
  const data = await parseAngelJson(res);
  if (!data.status) {
    const msg = angelError(data, "Quote failed");
    const { handleRateLimitMessage } = await import("./market-rate-limit");
    if (handleRateLimitMessage(msg)) throw new Error(msg);
    return [];
  }
  return (data.data as { fetched?: Record<string, unknown>[] })?.fetched ?? [];
}

/** Batch quotes — FULL (OI + volume) with OHLC fallback for missing tokens */
export async function getExtendedQuotes(
  exchange: string,
  tokens: string[]
): Promise<Map<string, ExtendedQuote>> {
  if (!tokens.length) return new Map();
  const { jwtToken, feedToken } = await getToken();
  const exch = exchange.toUpperCase();
  const out = new Map<string, ExtendedQuote>();

  for (let i = 0; i < tokens.length; i += 50) {
    const chunk = tokens.slice(i, i + 50);
    const fullRows = await fetchQuoteChunk(jwtToken, feedToken, exch, chunk, "FULL");
    const got = new Set<string>();
    for (const row of fullRows) {
      const q = mapExtendedQuote(row);
      if (q.symbolToken) {
        out.set(q.symbolToken, q);
        got.add(q.symbolToken);
      }
    }
    const missing = chunk.filter(t => !got.has(t));
    if (missing.length > 0) {
      const ohlcRows = await fetchQuoteChunk(jwtToken, feedToken, exch, missing, "OHLC");
      for (const row of ohlcRows) {
        const q = mapExtendedQuote(row);
        if (q.symbolToken && !out.has(q.symbolToken)) out.set(q.symbolToken, q);
      }
    }
  }
  return out;
}

/** Fast OHLC refresh for option chain tokens (single mode per chunk — avoids rate limits). */
export async function refreshOptionChainQuotes(
  exchange: string,
  tokens: string[]
): Promise<Map<string, ExtendedQuote>> {
  return getExtendedQuotes(exchange, tokens);
}

function applyQuoteToLeg(leg: OptionLeg, q: ExtendedQuote, prevOi?: number) {
  leg.ltp = q.ltp;
  leg.change = q.netChange;
  leg.changePct = q.percentChange;
  if (q.tradeVolume != null) leg.volume = q.tradeVolume;
  if (q.opnInterest != null) {
    leg.oi = q.opnInterest;
    if (prevOi != null && prevOi > 0) {
      leg.oiChange = q.opnInterest - prevOi;
      leg.oiChangePct = (leg.oiChange / prevOi) * 100;
    }
  }
  if (q.opnInterestChange != null) leg.oiChange = q.opnInterestChange;
  if (q.opnInterestChangePct != null) leg.oiChangePct = q.opnInterestChangePct;
}

/** Build option chain via Search Scrip (NFO/BFO) + batch quotes — no dedicated chain API in SmartAPI */
export async function getOptionChain(
  underlying: string,
  spotLtp?: number,
  expiryCode?: string,
  options?: { profile?: boolean },
): Promise<OptionChainResult> {
  const key = underlying.toUpperCase();
  const optExchange = optionChainExchange(key);
  const { jwtToken, feedToken } = await getToken();

  const res = await fetch(`${BASE_URL}${SEARCH_SCRIP_PATH}`, {
    method: "POST",
    headers: commonHeaders(jwtToken, feedToken),
    body: JSON.stringify({ exchange: optExchange, searchscrip: key }),
    cache: "no-store",
  });
  const data = await parseAngelJson(res);
  if (!data.status || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error(angelError(data, `No ${optExchange} option contracts found for ${key}`));
  }

  type Parsed = NonNullable<ReturnType<typeof parseOptionSymbol>> & { token: string };
  const parsed: Parsed[] = [];
  for (const row of (data.data as Record<string, string>[]).slice(0, 1200)) {
    const sym = row.tradingsymbol ?? "";
    const p = parseOptionSymbol(sym);
    const token = String(row.symboltoken ?? "").trim();
    if (p && p.underlying === key && token) parsed.push({ ...p, token });
  }
  if (!parsed.length) throw new Error(`No option strikes parsed for ${key}`);

  const expiryCodes = [...new Set(parsed.map(p => p.expiry))].sort();
  const expiries = expiryCodes.map(code => ({ code, label: formatExpiryLabel(code) }));
  const expiry = expiryCode && expiryCodes.includes(expiryCode) ? expiryCode : expiryCodes[0];
  const forExpiry = parsed.filter(p => p.expiry === expiry);

  let strikes = [...new Set(forExpiry.map(p => p.strike))].sort((a, b) => a - b);
  if (spotLtp && spotLtp > 0) {
    const atm = strikes.reduce((best, s) =>
      Math.abs(s - spotLtp) < Math.abs(best - spotLtp) ? s : best
    , strikes[0]);
    const idx = strikes.indexOf(atm);
    const half = options?.profile ? 35 : 15;
    const from = Math.max(0, idx - half);
    const to = Math.min(strikes.length, idx + half + 1);
    strikes = strikes.slice(from, to);
  } else {
    strikes = strikes.slice(0, options?.profile ? 71 : 31);
  }

  const byStrike = new Map<number, OptionChainRow>();
  for (const s of strikes) byStrike.set(s, { strike: s });

  const tokens: { exchange: string; symboltoken: string }[] = [];
  for (const p of forExpiry) {
    if (!strikes.includes(p.strike)) continue;
    const row = byStrike.get(p.strike)!;
    const leg: OptionLeg = { tradingsymbol: p.tradingsymbol, token: p.token };
    if (p.side === "CE") row.ce = leg;
    else row.pe = leg;
    tokens.push({ exchange: optExchange, symboltoken: p.token });
  }

  const tokenIds = [...new Set(tokens.map(t => t.symboltoken))];
  const quoteMap = await getExtendedQuotes(optExchange, tokenIds);

  for (const row of byStrike.values()) {
    for (const side of ["ce", "pe"] as const) {
      const leg = row[side];
      if (!leg) continue;
      const q = quoteMap.get(leg.token);
      if (q) applyQuoteToLeg(leg, q);
    }
  }

  return {
    underlying: key,
    exchange: optExchange,
    expiry,
    expiries,
    spot: spotLtp,
    rows: strikes.map(s => byStrike.get(s)!),
    tokens: tokenIds.map(token => ({ token, exchange: optExchange })),
  };
}

// ── Orders ────────────────────────────────────────────────────────────────────

export interface OrderParams {
  variety: "NORMAL" | "STOPLOSS" | "AMO";
  tradingsymbol: string;
  symboltoken: string;
  transactiontype: "BUY" | "SELL";
  exchange: "NSE" | "BSE" | "NFO" | "MCX" | "NCDEX";
  ordertype: "MARKET" | "LIMIT" | "STOPLOSS_LIMIT" | "STOPLOSS_MARKET";
  producttype: "DELIVERY" | "CARRYFORWARD" | "MARGIN" | "INTRADAY";
  duration: "DAY" | "IOC";
  price: string;
  squareoff?: string;
  stoploss?: string;
  triggerprice?: string;
  quantity: string;
}

export async function placeOrder(params: OrderParams) {
  const { jwtToken, feedToken } = await getToken();
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/order/v1/placeOrder`,
    {
      method: "POST",
      headers: commonHeaders(jwtToken, feedToken),
      body: JSON.stringify(params),
      cache: "no-store",
    }
  );
  return res.json();
}

export async function getOrderBook() {
  const { jwtToken, feedToken } = await getToken();
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/order/v1/getOrderBook`,
    {
      method: "GET",
      headers: commonHeaders(jwtToken, feedToken),
      cache: "no-store",
    }
  );
  return res.json();
}

// ── Instrument Registry ───────────────────────────────────────────────────────

export const MARKET_INSTRUMENTS = [
  { symbol: "NIFTY 50",   token: "99926000", exchange: "NSE" },
  { symbol: "SENSEX",     token: "99919000", exchange: "BSE" },
  { symbol: "NIFTY BANK", token: "99926009", exchange: "NSE" },
  { symbol: "RELIANCE",   token: "2885",     exchange: "NSE" },
  { symbol: "TCS",        token: "11536",    exchange: "NSE" },
  { symbol: "HDFCBANK",   token: "1333",     exchange: "NSE" },
  { symbol: "INFY",       token: "1594",     exchange: "NSE" },
  { symbol: "ICICIBANK",  token: "4963",     exchange: "NSE" },
  { symbol: "WIPRO",      token: "3787",     exchange: "NSE" },
  { symbol: "SBIN",       token: "3045",     exchange: "NSE" },
  { symbol: "BAJFINANCE", token: "317",      exchange: "NSE" },
  { symbol: "BHARTIARTL", token: "10604",    exchange: "NSE" },
  { symbol: "LT",         token: "11483",    exchange: "NSE" },
] as const;

export type KnownSymbol = (typeof MARKET_INSTRUMENTS)[number]["symbol"];
