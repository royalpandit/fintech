import crypto from "crypto";

const BASE    = "https://api.kite.trade";
const API_KEY = () => process.env.ZERODHA_API_KEY!;
const SECRET  = () => process.env.ZERODHA_API_SECRET!;

// ── Token cache (server-side, lives for the Node process) ─────────────────────

const g = globalThis as unknown as {
  kiteAccessToken: string | null;
  kiteTokenExpiry: number;
  kiteInstruments: KiteInstrument[] | null;
  kiteInstrumentsExpiry: number;
  kiteAllInstruments: KiteInstrument[] | null;
  kiteAllInstrumentsExpiry: number;
};
if (!g.kiteAccessToken)          g.kiteAccessToken          = null;
if (!g.kiteTokenExpiry)          g.kiteTokenExpiry          = 0;
if (!g.kiteInstruments)          g.kiteInstruments          = null;
if (!g.kiteInstrumentsExpiry)    g.kiteInstrumentsExpiry    = 0;
if (!g.kiteAllInstruments)       g.kiteAllInstruments       = null;
if (!g.kiteAllInstrumentsExpiry) g.kiteAllInstrumentsExpiry = 0;

export function getLoginURL(): string {
  return `https://kite.zerodha.com/connect/login?api_key=${API_KEY()}&v=3`;
}

export async function createSession(requestToken: string): Promise<string> {
  const checksum = crypto
    .createHash("sha256")
    .update(API_KEY() + requestToken + SECRET())
    .digest("hex");

  const res = await fetch(`${BASE}/session/token`, {
    method: "POST",
    headers: { "X-Kite-Version": "3", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ api_key: API_KEY(), request_token: requestToken, checksum }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.data?.access_token)
    throw new Error(`Kite session error: ${data.message ?? JSON.stringify(data)}`);

  const accessToken = data.data.access_token as string;
  // Tokens expire at 6 AM next day
  const exp = new Date(); exp.setDate(exp.getDate() + 1); exp.setHours(6, 0, 0, 0);
  g.kiteAccessToken = accessToken;
  g.kiteTokenExpiry = exp.getTime();
  return accessToken;
}

export function setAccessToken(token: string) {
  const exp = new Date(); exp.setDate(exp.getDate() + 1); exp.setHours(6, 0, 0, 0);
  g.kiteAccessToken = token;
  g.kiteTokenExpiry = exp.getTime();
}

export function getAccessToken(): string | null {
  if (g.kiteAccessToken && g.kiteTokenExpiry > Date.now()) return g.kiteAccessToken;
  return null;
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

function authHeaders() {
  const t = getAccessToken();
  if (!t) throw new Error("Zerodha not authenticated — visit /api/v1/auth/zerodha/login");
  return {
    "X-Kite-Version": "3",
    "Authorization": `token ${API_KEY()}:${t}`,
  };
}

// ── Instrument registry ───────────────────────────────────────────────────────
// instrument_token values — verify from https://api.kite.trade/instruments/NSE

export const MARKET_INSTRUMENTS = [
  { symbol: "NIFTY 50",   tradingsymbol: "NIFTY 50",   exchange: "NSE", token: "256265"  },
  { symbol: "NIFTY BANK", tradingsymbol: "NIFTY BANK", exchange: "NSE", token: "260105"  },
  { symbol: "SENSEX",     tradingsymbol: "SENSEX",      exchange: "BSE", token: "265"     },
  { symbol: "RELIANCE",   tradingsymbol: "RELIANCE",    exchange: "NSE", token: "738561"  },
  { symbol: "TCS",        tradingsymbol: "TCS",         exchange: "NSE", token: "2374913" },
  { symbol: "HDFCBANK",   tradingsymbol: "HDFCBANK",    exchange: "NSE", token: "341249"  },
  { symbol: "INFY",       tradingsymbol: "INFY",        exchange: "NSE", token: "408065"  },
  { symbol: "ICICIBANK",  tradingsymbol: "ICICIBANK",   exchange: "NSE", token: "1270529" },
  { symbol: "WIPRO",      tradingsymbol: "WIPRO",       exchange: "NSE", token: "3787265" },
  { symbol: "SBIN",       tradingsymbol: "SBIN",        exchange: "NSE", token: "779521"  },
  { symbol: "BHARTIARTL", tradingsymbol: "BHARTIARTL",  exchange: "NSE", token: "2714625" },
  { symbol: "LT",         tradingsymbol: "LT",          exchange: "NSE", token: "2939649" },
] as const;

export type KnownSymbol = (typeof MARKET_INSTRUMENTS)[number]["symbol"];

// ── LTP / OHLC ────────────────────────────────────────────────────────────────

export interface LTPData {
  symbolToken: string;
  exchange: string;
  tradingSymbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  percentChange: number;
  netChange: number;
}

/**
 * instruments: { exchange, symboltoken, tradingsymbol? }[]
 * symboltoken  = Zerodha instrument_token (string)
 * tradingsymbol = required if not a preset instrument
 */
export async function getLTP(
  instruments: { exchange: string; symboltoken: string; tradingsymbol?: string }[]
): Promise<LTPData[]> {
  if (!instruments.length) return [];

  const tokenMap = new Map<string, (typeof MARKET_INSTRUMENTS)[number]>(MARKET_INSTRUMENTS.map(m => [m.token as string, m]));

  // Build exchange:symbol keys for Kite OHLC API
  const keys: { ek: string; token: string }[] = [];
  for (const inst of instruments) {
    const preset = tokenMap.get(inst.symboltoken);
    if (preset) {
      keys.push({ ek: `${preset.exchange}:${preset.tradingsymbol}`, token: inst.symboltoken });
    } else if (inst.tradingsymbol) {
      keys.push({ ek: `${inst.exchange}:${inst.tradingsymbol}`, token: inst.symboltoken });
    }
  }
  if (!keys.length) return [];

  const qs = keys.map(k => `i=${encodeURIComponent(k.ek)}`).join("&");
  const res = await fetch(`${BASE}/quote/ohlc?${qs}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.data) return [];

  const ekToToken = new Map(keys.map(k => [k.ek, k.token]));
  const ekToTokenLower = new Map(keys.map(k => [k.ek.toUpperCase(), k.token]));

  return Object.entries(data.data as Record<string, {
    instrument_token: number;
    last_price: number;
    ohlc: { open: number; high: number; low: number; close: number };
    net_change?: number;
  }>).map(([ek, q]) => {
    const [exch, sym] = ek.split(":");
    const token = ekToToken.get(ek) ?? ekToTokenLower.get(ek.toUpperCase()) ?? String(q.instrument_token);
    const pct   = q.ohlc.close > 0 ? ((q.last_price - q.ohlc.close) / q.ohlc.close) * 100 : 0;
    return {
      symbolToken:   token,
      exchange:      exch,
      tradingSymbol: sym,
      ltp:           q.last_price,
      open:          q.ohlc.open,
      high:          q.ohlc.high,
      low:           q.ohlc.low,
      close:         q.ohlc.close,
      percentChange: pct,
      netChange:     q.net_change ?? (q.last_price - q.ohlc.close),
    };
  });
}

// ── Historical candles ────────────────────────────────────────────────────────

export type CandleInterval =
  | "ONE_MINUTE" | "THREE_MINUTE" | "FIVE_MINUTE" | "TEN_MINUTE"
  | "FIFTEEN_MINUTE" | "THIRTY_MINUTE" | "ONE_HOUR" | "ONE_DAY";

const INTERVAL_MAP: Record<CandleInterval, string> = {
  ONE_MINUTE:     "minute",
  THREE_MINUTE:   "3minute",
  FIVE_MINUTE:    "5minute",
  TEN_MINUTE:     "10minute",
  FIFTEEN_MINUTE: "15minute",
  THIRTY_MINUTE:  "30minute",
  ONE_HOUR:       "60minute",
  ONE_DAY:        "day",
};

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** fromdate / todate format: "YYYY-MM-DD HH:MM" (same as Angel One) */
export async function getCandles(params: {
  exchange: string;
  symboltoken: string;   // Zerodha instrument_token
  interval: CandleInterval;
  fromdate: string;
  todate: string;
}): Promise<Candle[]> {
  const kiteInterval = INTERVAL_MAP[params.interval];
  const url = `${BASE}/instruments/historical/${params.symboltoken}/${kiteInterval}?from=${encodeURIComponent(params.fromdate + ":00")}&to=${encodeURIComponent(params.todate + ":00")}`;

  console.log("[getCandles] url=%s", url);
  const res  = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  const data = await res.json();
  console.log("[getCandles] status=%s httpStatus=%d keys=%s", data.status, res.status, Object.keys(data).join(","));
  if (data.status === "error" || (!data.data && data.message)) {
    throw new Error(data.message ?? data.error_type ?? "Kite historical API error");
  }
  const raw: [string, number, number, number, number, number][] = data.data?.candles ?? [];
  return raw.map(([timestamp, open, high, low, close, volume]) => ({
    timestamp, open, high, low, close, volume,
  }));
}

// ── Instrument search ─────────────────────────────────────────────────────────
// All Kite instruments endpoints are public — no auth required.

interface KiteInstrument {
  instrument_token: string;
  tradingsymbol: string;
  name: string;
  exchange: string;
  instrument_type: string;
}

// CSV columns (0-based): instrument_token, exchange_token, tradingsymbol, name,
// last_price, expiry, strike, tick_size, lot_size, instrument_type, segment, exchange
function parseInstrumentCsv(csv: string, fallbackExchange: string): KiteInstrument[] {
  return csv.split("\n").slice(1).flatMap(line => {
    const cols = line.split(",");
    if (cols.length < 12) return [];
    const token = cols[0].trim();
    const tsym  = cols[2].trim();
    if (!token || !tsym) return [];
    return [{
      instrument_token: token,
      tradingsymbol:    tsym,
      name:             cols[3].trim(),
      exchange:         cols[11].trim() || fallbackExchange,
      instrument_type:  cols[9].trim(),
    }];
  });
}

// Load each exchange separately and merge — more reliable than the master dump
const ALL_EXCHANGES = ["NSE", "BSE", "NFO", "BFO", "MCX", "CDS"];

async function loadAllInstruments(): Promise<KiteInstrument[]> {
  const now = Date.now();
  if (g.kiteAllInstruments && g.kiteAllInstrumentsExpiry > now) return g.kiteAllInstruments;

  const results = await Promise.allSettled(
    ALL_EXCHANGES.map(exch =>
      fetch(`${BASE}/instruments/${exch}`, { headers: { "X-Kite-Version": "3" }, cache: "no-store" })
        .then(r => r.text())
        .then(csv => parseInstrumentCsv(csv, exch))
    )
  );

  const all: KiteInstrument[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  console.log("[loadAllInstruments] loaded %d instruments across %d exchanges", all.length, ALL_EXCHANGES.length);
  g.kiteAllInstruments       = all;
  g.kiteAllInstrumentsExpiry = now + 24 * 60 * 60 * 1000;
  return all;
}

async function loadExchangeInstruments(exchange: string): Promise<KiteInstrument[]> {
  const now = Date.now();
  if (g.kiteInstruments && g.kiteInstrumentsExpiry > now) return g.kiteInstruments;
  try {
    const res    = await fetch(`${BASE}/instruments/${exchange}`, { headers: { "X-Kite-Version": "3" }, cache: "no-store" });
    const csv    = await res.text();
    const parsed = parseInstrumentCsv(csv, exchange);
    g.kiteInstruments       = parsed;
    g.kiteInstrumentsExpiry = now + 24 * 60 * 60 * 1000;
    return parsed;
  } catch {
    return [];
  }
}

export interface SearchResult {
  exchange: string;
  tradingSymbol: string;
  symbolName: string;
  instrumentType: string;
  token: string;
}

export async function searchSymbol(exchange: string, query: string): Promise<SearchResult[]> {
  const q     = query.toUpperCase();
  const insts = exchange === "ALL"
    ? await loadAllInstruments()
    : await loadExchangeInstruments(exchange);

  const exact    = insts.filter(i => i.tradingsymbol.startsWith(q) || i.name.toUpperCase().startsWith(q));
  const contains = insts.filter(i =>
    !i.tradingsymbol.startsWith(q) && !i.name.toUpperCase().startsWith(q) &&
    (i.tradingsymbol.includes(q) || i.name.toUpperCase().includes(q))
  );

  return [...exact, ...contains].slice(0, 30).map(i => ({
    exchange:       i.exchange,
    tradingSymbol:  i.tradingsymbol,
    symbolName:     i.name || i.tradingsymbol,
    instrumentType: i.instrument_type || "EQ",
    token:          i.instrument_token,
  }));
}

// ── Orders ────────────────────────────────────────────────────────────────────

export interface OrderParams {
  variety: "regular" | "amo" | "co" | "iceberg";
  tradingsymbol: string;
  symboltoken: string;
  transactiontype: "BUY" | "SELL";
  exchange: "NSE" | "BSE" | "NFO" | "MCX" | "CDS";
  ordertype: "MARKET" | "LIMIT" | "SL" | "SL-M";
  producttype: "CNC" | "MIS" | "NRML";
  duration: "DAY" | "IOC";
  price: string;
  triggerprice?: string;
  squareoff?: string;
  stoploss?: string;
  quantity: string;
}

export async function placeOrder(params: OrderParams) {
  const body = new URLSearchParams({
    exchange:           params.exchange,
    tradingsymbol:      params.tradingsymbol,
    transaction_type:   params.transactiontype,
    order_type:         params.ordertype,
    product:            params.producttype,
    quantity:           params.quantity,
    price:              params.price,
    trigger_price:      params.triggerprice ?? "0",
    validity:           params.duration,
    disclosed_quantity: "0",
    squareoff:          params.squareoff ?? "0",
    stoploss:           params.stoploss ?? "0",
  });
  const res = await fetch(`${BASE}/orders/${params.variety}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  return res.json();
}

export async function getOrderBook() {
  const res = await fetch(`${BASE}/orders`, { headers: authHeaders(), cache: "no-store" });
  return res.json();
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
  const res  = await fetch(`${BASE}/portfolio/holdings`, { headers: authHeaders(), cache: "no-store" });
  const data = await res.json();
  return (data.data ?? []).map((h: Record<string, unknown>) => ({
    tradingsymbol:  h.tradingsymbol,
    exchange:       h.exchange,
    symboltoken:    String(h.instrument_token ?? ""),
    isin:           h.isin,
    quantity:       h.quantity,
    averageprice:   h.average_price,
    ltp:            h.last_price,
    close:          h.close_price,
    profitandloss:  h.pnl,
    pnlpercentage:  h.day_change_percentage,
    symbolname:     h.tradingsymbol,
  }));
}

export interface Position {
  symbolname: string;
  tradingsymbol: string;
  exchange: string;
  symboltoken: string;
  producttype: string;
  netqty: number;
  avgnetprice: number;
  ltp: number;
  unrealised: number;
  realised: number;
  pnl: number;
}

export async function getPositions(): Promise<Position[]> {
  const res  = await fetch(`${BASE}/portfolio/positions`, { headers: authHeaders(), cache: "no-store" });
  const data = await res.json();
  const all = [...(data.data?.net ?? []), ...(data.data?.day ?? [])];
  return all.map((p: Record<string, unknown>) => ({
    symbolname:    String(p.tradingsymbol ?? ""),
    tradingsymbol: String(p.tradingsymbol ?? ""),
    exchange:      String(p.exchange ?? ""),
    symboltoken:   String(p.instrument_token ?? ""),
    producttype:   String(p.product ?? ""),
    netqty:        Number(p.quantity),
    avgnetprice:   Number(p.average_price),
    ltp:           Number(p.last_price),
    unrealised:    Number(p.unrealised),
    realised:      Number(p.realised),
    pnl:           Number(p.pnl),
  }));
}
