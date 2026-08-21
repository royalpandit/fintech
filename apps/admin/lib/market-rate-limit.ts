/** Shared Angel One rate-limit guard + short TTL cache (server-side). */

import "server-only";

let blockedUntil = 0;

export function isRateLimited(): boolean {
  return Date.now() < blockedUntil;
}

export function markRateLimited(seconds = 25): void {
  blockedUntil = Date.now() + seconds * 1000;
}

export function isRateLimitMessage(msg: string): boolean {
  return /exceeding access rate|rate limit|too many request|access denied/i.test(msg);
}

export function handleRateLimitMessage(msg: string): boolean {
  if (isRateLimitMessage(msg)) {
    markRateLimited(30);
    (globalThis as typeof globalThis & { __angelRateLimitHook?: (s: number) => void })
      .__angelRateLimitHook?.(30);
    return true;
  }
  return false;
}

type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();

export async function withMarketCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  if (isRateLimited()) {
    throw new Error("Angel One rate limit — updates paused. Please wait a few seconds.");
  }
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const value = await fn();
    cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (handleRateLimitMessage(msg)) throw err;
    throw err;
  }
}

export function peekMarketCache<T>(key: string): T | undefined {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  return undefined;
}

const refreshing = new Set<string>();

/**
 * Stale-while-revalidate cache: returns fresh data if available,
 * stale data + background refresh if within staleTtlMs of expiry,
 * or blocks for a fresh fetch if no data exists at all.
 * Falls back to any stale entry on fetch error.
 */
export async function withSWRCache<T>(
  key: string,
  ttlMs: number,
  staleTtlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (isRateLimited()) {
    throw new Error("Angel One rate limit — updates paused. Please wait a few seconds.");
  }
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;

  if (hit && hit.expires > now) return hit.value;

  if (hit && now - hit.expires < staleTtlMs && !refreshing.has(key)) {
    refreshing.add(key);
    fn()
      .then(value => cache.set(key, { value, expires: Date.now() + ttlMs }))
      .catch(err => { handleRateLimitMessage(err instanceof Error ? err.message : String(err)); })
      .finally(() => refreshing.delete(key));
    return hit.value;
  }

  try {
    const value = await fn();
    cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  } catch (err) {
    if (hit) return hit.value;
    const msg = err instanceof Error ? err.message : String(err);
    if (handleRateLimitMessage(msg)) throw err;
    throw err;
  }
}
