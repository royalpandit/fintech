import crypto from "crypto";

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

function commonHeaders(jwt: string, feed: string) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${jwt}`,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "192.168.1.1",
    "X-ClientPublicIP": "106.193.147.98",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": process.env.ANGELONE_API_KEY!,
    "X-ClientCode": process.env.ANGELONE_CLIENT_CODE!,
    "X-FeedToken": feed,
  };
}

async function login(): Promise<TokenCache> {
  // Try current window then adjacent windows to handle clock drift
  for (const offset of [0, -1, 1]) {
    const totp = generateTOTP(process.env.ANGELONE_TOTP_SECRET!, offset);
    const res = await fetch(
      `${BASE_URL}/rest/auth/angelbroking/user/v1/loginByPassword`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "192.168.1.1",
          "X-ClientPublicIP": "106.193.147.98",
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
  }
  throw new Error("Angel One authentication failed");
}

export async function getToken(): Promise<TokenCache> {
  if (_cache && _cache.expiresAt > Date.now() + 60_000) return _cache;
  return login();
}

// ── Market Data ──────────────────────────────────────────────────────────────

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

/** Fetch Last Traded Price for a list of instruments. */
export async function getLTP(
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
      body: JSON.stringify({ mode: "LTP", exchangeTokens }),
      next: { revalidate: 0 },
    }
  );
  const data = await res.json();
  return data.data?.fetched ?? [];
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
  interval: CandleInterval;
  fromdate: string;
  todate: string;
}): Promise<Candle[]> {
  const { jwtToken, feedToken } = await getToken();
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData`,
    {
      method: "POST",
      headers: commonHeaders(jwtToken, feedToken),
      body: JSON.stringify(params),
      next: { revalidate: 0 },
    }
  );
  const data = await res.json();
  // Response: array of [timestamp, open, high, low, close, volume]
  const raw: [string, number, number, number, number, number][] =
    data.data ?? [];
  return raw.map(([timestamp, open, high, low, close, volume]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  }));
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

// ── Instrument Registry ───────────────────────────────────────────────────────

export const MARKET_INSTRUMENTS = [
  { symbol: "NIFTY 50", token: "99926000", exchange: "NSE" },
  { symbol: "SENSEX", token: "99919000", exchange: "BSE" },
  { symbol: "NIFTY BANK", token: "99926009", exchange: "NSE" },
  { symbol: "RELIANCE", token: "2885", exchange: "NSE" },
  { symbol: "TCS", token: "11536", exchange: "NSE" },
  { symbol: "HDFCBANK", token: "1333", exchange: "NSE" },
  { symbol: "INFY", token: "1594", exchange: "NSE" },
  { symbol: "ICICIBANK", token: "4963", exchange: "NSE" },
  { symbol: "WIPRO", token: "3787", exchange: "NSE" },
  { symbol: "SBIN", token: "3045", exchange: "NSE" },
  { symbol: "BAJFINANCE", token: "317", exchange: "NSE" },
  { symbol: "BHARTIARTL", token: "10604", exchange: "NSE" },
] as const;

export type KnownSymbol = (typeof MARKET_INSTRUMENTS)[number]["symbol"];
