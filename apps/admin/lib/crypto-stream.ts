import "server-only";

process.env.WS_NO_BUFFER_UTIL = process.env.WS_NO_BUFFER_UTIL ?? "1";
process.env.WS_NO_UTF_8_VALIDATE = process.env.WS_NO_UTF_8_VALIDATE ?? "1";

import WebSocket from "ws";

export type CryptoTick = {
  id: string;
  symbol: string;
  priceUsd: number;
  change24h: number;
  provider: "binance" | "coinbase";
  ts: number;
};

export type CryptoSymbol = {
  id: string;
  binance: string;
  coinbase: string;
};

/** CoinGecko ids we already show on the Crypto tab → exchange symbols. */
export const CRYPTO_STREAM_SYMBOLS: CryptoSymbol[] = [
  { id: "bitcoin", binance: "btcusdt", coinbase: "BTC-USD" },
  { id: "ethereum", binance: "ethusdt", coinbase: "ETH-USD" },
  { id: "tether", binance: "usdtusdt", coinbase: "USDT-USD" },
  { id: "binancecoin", binance: "bnbusdt", coinbase: "BNB-USD" },
  { id: "solana", binance: "solusdt", coinbase: "SOL-USD" },
  { id: "ripple", binance: "xrpusdt", coinbase: "XRP-USD" },
  { id: "usd-coin", binance: "usdcusdt", coinbase: "USDC-USD" },
  { id: "cardano", binance: "adausdt", coinbase: "ADA-USD" },
  { id: "dogecoin", binance: "dogeusdt", coinbase: "DOGE-USD" },
  { id: "tron", binance: "trxusdt", coinbase: "TRX-USD" },
];

type Listener = (tick: CryptoTick) => void;

function binanceBase(): string {
  return (process.env.BINANCE_WS_URL || "wss://stream.binance.com:9443/ws").replace(/\/$/, "");
}

function coinbaseUrl(): string {
  return process.env.COINBASE_WS_URL || "wss://ws-feed.exchange.coinbase.com";
}

class CryptoStreamHub {
  private ws: WebSocket | null = null;
  private provider: "binance" | "coinbase" | null = null;
  private listeners = new Set<Listener>();
  private wanted = new Set<string>();
  private connectPromise: Promise<void> | null = null;
  private binanceCoolUntil = 0;

  subscribe(ids: string[], onTick: Listener): () => void {
    for (const id of ids) this.wanted.add(id);
    this.listeners.add(onTick);
    void this.ensureConnected();
    return () => {
      this.listeners.delete(onTick);
      if (!this.listeners.size) this.disconnect();
    };
  }

  private emit(tick: CryptoTick) {
    for (const l of this.listeners) {
      try {
        l(tick);
      } catch {
        /* ignore */
      }
    }
  }

  private disconnect() {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.provider = null;
    this.connectPromise = null;
  }

  private specs(): CryptoSymbol[] {
    const wanted = this.wanted.size
      ? CRYPTO_STREAM_SYMBOLS.filter((s) => this.wanted.has(s.id))
      : CRYPTO_STREAM_SYMBOLS;
    return wanted.filter((s) => s.binance !== "usdtusdt");
  }

  private async ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.connect();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async connect(): Promise<void> {
    const tryBinance = Date.now() >= this.binanceCoolUntil;
    if (tryBinance) {
      try {
        await this.openBinance();
        return;
      } catch (e) {
        this.binanceCoolUntil = Date.now() + 60_000;
        console.warn("[crypto-stream] Binance failed, falling over to Coinbase:", e instanceof Error ? e.message : e);
      }
    }
    await this.openCoinbase();
  }

  private openSocket(url: string, provider: "binance" | "coinbase", onOpen: (ws: WebSocket) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          reject(new Error(`${provider} websocket timeout`));
        }
      }, 8_000);

      ws.on("open", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.ws = ws;
        this.provider = provider;
        onOpen(ws);
        resolve();
      });
      ws.on("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
      ws.on("close", () => {
        if (this.ws === ws) {
          this.ws = null;
          this.provider = null;
          if (this.listeners.size) {
            setTimeout(() => void this.ensureConnected(), 1_500);
          }
        }
      });
      ws.on("message", (raw) => {
        try {
          this.onMessage(JSON.parse(String(raw)), provider);
        } catch {
          /* ignore non-json */
        }
      });
    });
  }

  private async openBinance() {
    const specs = this.specs();
    const streams = specs.map((s) => `${s.binance}@ticker`).join("/");
    const combined = binanceBase().replace(/\/ws$/, `/stream?streams=${streams}`);
    await this.openSocket(combined, "binance", () => undefined);
  }

  private async openCoinbase() {
    const specs = this.specs();
    await this.openSocket(coinbaseUrl(), "coinbase", (ws) => {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: specs.map((s) => s.coinbase),
          channels: ["ticker"],
        }),
      );
    });
  }

  private onMessage(msg: Record<string, unknown>, provider: "binance" | "coinbase") {
    if (provider === "binance") {
      const data = (msg.data as Record<string, unknown> | undefined) ?? msg;
      const sym = String(data.s ?? "").toLowerCase();
      const spec = this.specs().find((s) => s.binance === sym);
      if (!spec) return;
      const price = Number(data.c);
      if (!Number.isFinite(price)) return;
      this.emit({
        id: spec.id,
        symbol: spec.binance.replace("usdt", "").toUpperCase(),
        priceUsd: price,
        change24h: Number(data.P ?? 0),
        provider: "binance",
        ts: Date.now(),
      });
      return;
    }

    if (msg.type !== "ticker") return;
    const product = String(msg.product_id ?? "");
    const spec = this.specs().find((s) => s.coinbase === product);
    if (!spec) return;
    const price = Number(msg.price);
    if (!Number.isFinite(price)) return;
    const open = Number(msg.open_24h);
    const change24h = open ? ((price - open) / open) * 100 : 0;
    this.emit({
      id: spec.id,
      symbol: spec.coinbase.split("-")[0] ?? spec.id,
      priceUsd: price,
      change24h,
      provider: "coinbase",
      ts: Date.now(),
    });
  }
}

const g = globalThis as unknown as { cryptoStreamHub?: CryptoStreamHub };
export function getCryptoStreamHub(): CryptoStreamHub {
  if (!g.cryptoStreamHub) g.cryptoStreamHub = new CryptoStreamHub();
  return g.cryptoStreamHub;
}
