/**
 * Dhan market-feed stream hub.
 * Replaces the Angel One WebSocket with REST LTP polling every 2 s,
 * keeping the same public interface (subscribeMany / getStatus) so the
 * SSE stream route works unchanged.
 */

import "server-only";

import { getLTP } from "@/lib/dhan";
import {
  recordWsTick,
  setWsConnectionCount,
  trackSubscription,
} from "@/lib/angelone-metrics";

export type StreamTick = {
  token: string;
  exchange: string;
  ltp: number;
  volume?: number;
  ts: number;
};

type Listener = (tick: StreamTick) => void;

class DhanStreamHub {
  private refCounts = new Map<string, number>();
  private listeners = new Map<string, Set<Listener>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  private parseMeta(key: string): { exchange: string; token: string } | null {
    const i = key.indexOf(":");
    if (i < 0) return null;
    return { exchange: key.slice(0, i), token: key.slice(i + 1) };
  }

  private start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.poll(), 15_000);
  }

  private stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async poll() {
    const keys = [...this.refCounts.keys()].filter(k => (this.refCounts.get(k) ?? 0) > 0);
    if (!keys.length) return;

    const instruments = keys
      .map(k => this.parseMeta(k))
      .filter(Boolean)
      .map(m => ({ exchange: m!.exchange, symboltoken: m!.token }));

    try {
      const quotes = await getLTP(instruments);
      for (const q of quotes) {
        // Quote exchange comes back as Dhan segment ("NSE_EQ") — form the same
        // key used for subscription so listeners resolve correctly.
        const key = `${q.exchange}:${q.symbolToken}`;
        const set = this.listeners.get(key);
        if (!set?.size) continue;
        const tick: StreamTick = {
          token:    q.symbolToken,
          exchange: q.exchange,
          ltp:      q.ltp,
          ts:       Date.now(),
        };
        recordWsTick();
        for (const fn of set) fn(tick);
      }
    } catch {
      // Transient — next tick will retry
    }
  }

  async subscribe(exchange: string, token: string, listener: Listener): Promise<() => void> {
    const key = `${exchange.toUpperCase()}:${token}`;
    this.refCounts.set(key, (this.refCounts.get(key) ?? 0) + 1);
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(listener);
    trackSubscription(key, true);
    setWsConnectionCount(this.refCounts.size);
    this.start();
    return () => this.unsubscribe(exchange, token, listener);
  }

  private unsubscribe(exchange: string, token: string, listener: Listener) {
    const key = `${exchange.toUpperCase()}:${token}`;
    const set = this.listeners.get(key);
    set?.delete(listener);
    const prev = this.refCounts.get(key) ?? 0;
    const next = Math.max(0, prev - 1);
    if (next === 0) {
      this.refCounts.delete(key);
      this.listeners.delete(key);
      trackSubscription(key, false);
    } else {
      this.refCounts.set(key, next);
    }
    setWsConnectionCount(this.refCounts.size);
    if (this.refCounts.size === 0) this.stop();
  }

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
      refCount:     this.refCounts.size,
      listenerKeys: this.listeners.size,
      rateLimited:  false,
    };
  }
}

const G = globalThis as typeof globalThis & { __dhanStreamHub?: DhanStreamHub };

export function getDhanStreamHub(): DhanStreamHub {
  G.__dhanStreamHub ??= new DhanStreamHub();
  return G.__dhanStreamHub;
}
