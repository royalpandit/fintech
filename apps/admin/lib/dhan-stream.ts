/*
 * Market-feed stream hub.
 *
 * The push side is dormant. It polled the broker for LTP, and subscriptions
 * are keyed `EXCHANGE:TOKEN` with no symbol in them — which is exactly what a
 * free feed needs, since Yahoo prices by name and nothing free prices an
 * option contract by any key at all.
 *
 * Nothing is lost by it being quiet: both callers already poll on their own and
 * faster. The terminal refreshes quotes from Yahoo every 5 s against this hub's
 * 15, and the option chain re-reads NSE every 15 s. So the hub keeps its
 * interface and its bookkeeping, and simply emits no ticks until there is a
 * feed it can legitimately pull from.
 */

import "server-only";
import { setWsConnectionCount, trackSubscription } from "@/lib/angelone-metrics";

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

  /*
   * No timer while there is no feed to poll. Subscriptions are still tracked,
   * so wiring a free push source later means restoring this and nothing else.
   */
  private start() {}

  private stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
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
