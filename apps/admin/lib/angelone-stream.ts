/**
 * Single Angel One WebSocket V2 connection per Node process.
 * Server-only — do not import from client components.
 */

import "server-only";

import { getToken } from "@/lib/angelone";
import { subscriptionKey, toAngelExchangeType } from "@/lib/angelone-exchange";
import {
  recordWsTick,
  setWsConnectionCount,
  trackSubscription,
} from "@/lib/angelone-metrics";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WebSocketV2 } = require("smartapi-javascript") as {
  WebSocketV2: new (p: {
    clientcode: string;
    jwttoken: string;
    apikey: string;
    feedtype: string;
  }) => AngelWsClient;
};

type AngelWsClient = {
  connect: () => Promise<unknown>;
  fetchData: (req: {
    correlationID?: string;
    action: number;
    mode: number;
    exchangeType: number;
    tokens: string[];
  }) => void;
  on: (event: "tick", cb: (data: Record<string, unknown>) => void) => void;
  close: () => void;
  reconnection: (type: string, delayMs: number, multiplier?: number) => void;
};

const ACTION_SUB = 1;
const ACTION_UNSUB = 0;
const MODE_LTP = 1;

export type StreamTick = {
  token: string;
  exchange: string;
  ltp: number;
  volume?: number;
  ts: number;
};

type Listener = (tick: StreamTick) => void;

class AngelStreamHub {
  private ws: AngelWsClient | null = null;
  private connectPromise: Promise<void> | null = null;
  private refCounts = new Map<string, number>();
  private listeners = new Map<string, Set<Listener>>();
  private rateLimitedUntil = 0;

  private tokenMeta(key: string): { exchange: string; token: string } | null {
    const i = key.indexOf(":");
    if (i < 0) return null;
    return { exchange: key.slice(0, i), token: key.slice(i + 1) };
  }

  private parseLtp(data: Record<string, unknown>): number | null {
    const raw =
      data.last_traded_price ??
      data.ltp ??
      data.lastTradedPrice;
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    // SmartAPI sends prices in paise for many instruments
    return n > 1_000_000 ? n / 100 : n;
  }

  private parseToken(data: Record<string, unknown>): string {
    const t = data.token;
    if (typeof t === "string") return t.replace(/"/g, "").trim();
    return String(t ?? "").trim();
  }

  private async ensureConnected(): Promise<void> {
    if (this.ws && Date.now() > this.rateLimitedUntil) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      const { jwtToken, feedToken } = await getToken();
      const apiKey = process.env.ANGELONE_API_KEY;
      const clientCode = process.env.ANGELONE_CLIENT_CODE;
      if (!apiKey || !clientCode) throw new Error("Angel One credentials missing");

      if (this.ws) {
        try { this.ws.close(); } catch { /* ignore */ }
      }

      const ws = new WebSocketV2({
        clientcode: clientCode,
        jwttoken: jwtToken,
        apikey: apiKey,
        feedtype: feedToken,
      });
      ws.reconnection("exponential", 3_000, 2);
      ws.on("tick", (data: Record<string, unknown>) => {
        recordWsTick();
        const token = this.parseToken(data);
        const exchangeType = Number(data.exchange_type ?? 1);
        const ltp = this.parseLtp(data);
        if (!token || ltp == null) return;

        const exchange =
          exchangeType === 2 ? "NFO" :
          exchangeType === 4 ? "BFO" :
          exchangeType === 3 ? "BSE" :
          exchangeType === 5 ? "MCX" : "NSE";

        const key = subscriptionKey(exchange, token);
        const tick: StreamTick = {
          token,
          exchange,
          ltp,
          volume: data.vol_traded != null ? Number(data.vol_traded) : undefined,
          ts: Date.now(),
        };
        for (const fn of this.listeners.get(key) ?? []) fn(tick);
      });

      await ws.connect();
      this.ws = ws;
      setWsConnectionCount(1);
      console.info("[AngelOne WS] connected (single process stream)");

      // Re-subscribe after reconnect
      for (const key of this.refCounts.keys()) {
        const meta = this.tokenMeta(key);
        if (meta && (this.refCounts.get(key) ?? 0) > 0) {
          this.sendSubscribe(meta.exchange, [meta.token]);
        }
      }
    })().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private sendSubscribe(exchange: string, tokens: string[]) {
    if (!this.ws || !tokens.length) return;
    this.ws.fetchData({
      correlationID: `sub-${exchange}-${Date.now()}`,
      action: ACTION_SUB,
      mode: MODE_LTP,
      exchangeType: toAngelExchangeType(exchange),
      tokens,
    });
  }

  private sendUnsubscribe(exchange: string, tokens: string[]) {
    if (!this.ws || !tokens.length) return;
    this.ws.fetchData({
      correlationID: `unsub-${exchange}-${Date.now()}`,
      action: ACTION_UNSUB,
      mode: MODE_LTP,
      exchangeType: toAngelExchangeType(exchange),
      tokens,
    });
  }

  markRateLimited(seconds = 30) {
    this.rateLimitedUntil = Date.now() + seconds * 1000;
    console.warn("[AngelOne WS] rate limited — pausing reconnect", { seconds });
  }

  async subscribe(exchange: string, token: string, listener: Listener): Promise<() => void> {
    const key = subscriptionKey(exchange, token);
    const prev = this.refCounts.get(key) ?? 0;
    this.refCounts.set(key, prev + 1);
    trackSubscription(key, true);

    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(listener);

    if (prev === 0) {
      await this.ensureConnected();
      this.sendSubscribe(exchange, [token]);
    }

    return () => this.unsubscribe(exchange, token, listener);
  }

  private unsubscribe(exchange: string, token: string, listener: Listener) {
    const key = subscriptionKey(exchange, token);
    const set = this.listeners.get(key);
    set?.delete(listener);
    if (set && set.size === 0) this.listeners.delete(key);

    const prev = this.refCounts.get(key) ?? 0;
    const next = Math.max(0, prev - 1);
    if (next === 0) {
      this.refCounts.delete(key);
      trackSubscription(key, false);
      this.sendUnsubscribe(exchange, [token]);
    } else {
      this.refCounts.set(key, next);
    }
  }

  /** Batch subscribe (e.g. on SSE connect) — deduped by ref count. */
  async subscribeMany(
    items: { exchange: string; token: string }[],
    listener: Listener,
  ): Promise<() => void> {
    const unsubs: Array<() => void> = [];
    for (const { exchange, token } of items) {
      unsubs.push(await this.subscribe(exchange, token, listener));
    }
    return () => unsubs.forEach(u => u());
  }

  getStatus() {
    return {
      refCount: this.refCounts.size,
      listenerKeys: this.listeners.size,
      rateLimited: Date.now() < this.rateLimitedUntil,
    };
  }
}

const globalForAngel = globalThis as typeof globalThis & { __angelStreamHub?: AngelStreamHub };

export function getAngelStreamHub(): AngelStreamHub {
  if (!globalForAngel.__angelStreamHub) {
    globalForAngel.__angelStreamHub = new AngelStreamHub();
    const hub = globalForAngel.__angelStreamHub;
    (globalThis as typeof globalThis & { __angelRateLimitHook?: (s: number) => void }).__angelRateLimitHook =
      (seconds: number) => hub.markRateLimited(seconds);
  }
  return globalForAngel.__angelStreamHub;
}
