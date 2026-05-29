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
    result.finally(() => {
      if (inflight.get(dedupeKey) === result) inflight.delete(dedupeKey);
    });
  }
  return result;
}
