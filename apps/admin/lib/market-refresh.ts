/**
 * How often live prices should be refreshed.
 *
 * Shared by the server (cache TTL) and the browser (poll interval) so the two
 * cannot drift apart. A client polling faster than the server's cache just
 * re-reads the same cached object; a client polling slower wastes a fetch the
 * server already paid for. They are the same number for a reason.
 *
 * Client-safe: no server-only imports, because both sides need it.
 */

import { isMarketOpenNow } from "@/lib/nse-market-time";

/**
 * During the session. One Dhan call covers every instrument on the board
 * (getExtendedQuotes batches them into a single /marketfeed/quote POST), so
 * this costs ~0.33 req/s no matter how many browser tabs are open — the server
 * cache collapses them. That leaves plenty of headroom on the 850 ms global
 * REST chain for the watchlist, the terminal and the basket sweep.
 */
export const LIVE_REFRESH_MS = 3_000;

/**
 * Outside the session nothing moves, so polling at three seconds would spend
 * the entire rate-limit budget re-fetching yesterday's closing prices. This is
 * slow enough to be free and quick enough to pick up the open.
 */
export const CLOSED_REFRESH_MS = 30_000;

/**
 * Yahoo needs its own, slower cadence.
 *
 * Dhan answers the whole board in one request; Yahoo's usable endpoint is one
 * request per symbol, so a 13-instrument board at three seconds would be ~4.3
 * req/s to a public feed that will start refusing them. Fallback is a degraded
 * mode, and a slower tick is part of the degradation.
 */
export const FALLBACK_REFRESH_MS = 15_000;

export function quoteRefreshMs(nowMs = Date.now()): number {
  return isMarketOpenNow(nowMs) ? LIVE_REFRESH_MS : CLOSED_REFRESH_MS;
}
