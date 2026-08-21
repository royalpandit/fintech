/**
 * Ordered provider failover.
 *
 * Several feeds in "Finuer API providers" come in pairs — a preferred source
 * and a backup (Yahoo → Twelve Data, CoinGecko keyed → keyless, Chittorgarh →
 * IPOWatch). This runs them in order and returns the first success.
 *
 * A provider that fails is remembered briefly so the next request skips it
 * instead of paying its timeout again. Without that, a dead primary makes every
 * single request slow rather than just the first one.
 */

export type Provider<T> = {
  /** Short identifier, surfaced to callers and used as the cooldown key. */
  name: string;
  run: () => Promise<T>;
  /** Skip without attempting — e.g. an optional API key isn't set. */
  enabled?: boolean;
};

export type FailoverResult<T> = {
  value: T;
  /** Which provider produced the value. */
  provider: string;
  /** Providers tried and rejected before this one succeeded. */
  failed: { provider: string; error: string }[];
};

/** How long a failed provider is skipped for. */
const COOLDOWN_MS = 60_000;
const cooldown = new Map<string, number>();

function isCoolingDown(name: string): boolean {
  const until = cooldown.get(name);
  if (until == null) return false;
  if (Date.now() >= until) {
    cooldown.delete(name);
    return false;
  }
  return true;
}

/** Clear a provider's cooldown — useful in tests, or after a config change. */
export function resetProviderCooldown(name?: string): void {
  if (name) cooldown.delete(name);
  else cooldown.clear();
}

/**
 * Try each provider in order; resolve with the first success.
 *
 * Providers still in cooldown are skipped on the first pass, but retried if
 * every other option also fails — a stale cooldown should never be the reason
 * a request returns nothing.
 */
export async function firstSuccess<T>(
  providers: Provider<T>[],
): Promise<FailoverResult<T>> {
  const usable = providers.filter((p) => p.enabled !== false);
  if (!usable.length) throw new Error("No providers configured");

  const failed: { provider: string; error: string }[] = [];
  const skipped: Provider<T>[] = [];

  const attempt = async (p: Provider<T>): Promise<FailoverResult<T> | null> => {
    try {
      const value = await p.run();
      cooldown.delete(p.name);
      return { value, provider: p.name, failed: [...failed] };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      failed.push({ provider: p.name, error });
      cooldown.set(p.name, Date.now() + COOLDOWN_MS);
      return null;
    }
  };

  for (const p of usable) {
    if (isCoolingDown(p.name)) {
      skipped.push(p);
      continue;
    }
    const hit = await attempt(p);
    if (hit) return hit;
  }

  // Everything healthy failed — fall back to whatever we skipped.
  for (const p of skipped) {
    const hit = await attempt(p);
    if (hit) return hit;
  }

  const detail = failed.map((f) => `${f.provider}: ${f.error}`).join("; ");
  throw new Error(`All providers failed — ${detail || "none attempted"}`);
}

/** fetch() that rejects on non-2xx and enforces a timeout. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 10_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Same timeout/non-2xx rules as fetchJson, for HTML pages (GMP scrapes). */
export async function fetchText(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<string> {
  const { timeoutMs = 12_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
