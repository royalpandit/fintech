/**
 * Serializes Angel REST quote/candle calls to avoid burst rate limits.
 * Deduplicates identical in-flight requests.
 */

import "server-only";

import { recordRestRequest } from "@/lib/angelone-metrics";

const MIN_GAP_MS = 850;
let lastAt = 0;
let chain: Promise<unknown> = Promise.resolve();

const inflight = new Map<string, Promise<unknown>>();

function waitGap(): Promise<void> {
  const delay = Math.max(0, MIN_GAP_MS - (Date.now() - lastAt));
  if (delay <= 0) return Promise.resolve();
  return new Promise(r => setTimeout(r, delay));
}

/** Run Angel REST work with global spacing + optional dedupe key. */
export function scheduleAngelRest<T>(label: string, fn: () => Promise<T>, dedupeKey?: string): Promise<T> {
  if (dedupeKey) {
    const hit = inflight.get(dedupeKey) as Promise<T> | undefined;
    if (hit) return hit;
  }

  const run = chain.then(async () => {
    await waitGap();
    lastAt = Date.now();
    recordRestRequest(label);
    return fn();
  });

  chain = run.catch(() => undefined);

  const result = run as Promise<T>;
  if (dedupeKey) {
    inflight.set(dedupeKey, result);
    /*
     * .then(cleanup, cleanup), not .finally(cleanup).
     *
     * .finally returns a NEW promise that rejects whenever the one it is
     * chained to rejects. Nothing awaited that derived promise, so a failing
     * deduped call - a Dhan 429, an expired token - produced an unhandled
     * rejection and took the process down, even though the caller had the
     * original result in a try/catch and handled it correctly.
     *
     * Passing the same handler to both arms settles the derived promise either
     * way, so the cleanup still runs and there is nothing left unhandled.
     */
    const cleanup = () => {
      if (inflight.get(dedupeKey) === result) inflight.delete(dedupeKey);
    };
    result.then(cleanup, cleanup);
  }
  return result;
}
