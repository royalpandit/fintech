/**
 * Angel One WebSocket V2 — replaced by dhan-stream.ts.
 * This file is kept as a stub so existing imports don't break during migration.
 * Active implementation: lib/dhan-stream.ts → getDhanStreamHub()
 */

export type StreamTick = {
  token: string;
  exchange: string;
  ltp: number;
  volume?: number;
  ts: number;
};

type Listener = (tick: StreamTick) => void;

class AngelStreamHub {
  async subscribe(_exchange: string, _token: string, _listener: Listener): Promise<() => void> {
    throw new Error("Angel One WebSocket disabled — use getDhanStreamHub() from @/lib/dhan-stream");
  }

  async subscribeMany(
    _items: { exchange: string; token: string }[],
    _listener: Listener,
  ): Promise<() => void> {
    throw new Error("Angel One WebSocket disabled — use getDhanStreamHub() from @/lib/dhan-stream");
  }

  getStatus() {
    return { refCount: 0, listenerKeys: 0, rateLimited: false };
  }
}

const globalForAngel = globalThis as typeof globalThis & { __angelStreamHub?: AngelStreamHub };

export function getAngelStreamHub(): AngelStreamHub {
  if (!globalForAngel.__angelStreamHub) {
    globalForAngel.__angelStreamHub = new AngelStreamHub();
  }
  return globalForAngel.__angelStreamHub;
}
