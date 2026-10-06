import { NextResponse, type NextRequest } from "next/server";
import { getOptionChain, optionUnderlyingKey } from "@/lib/dhan";
import { withSWRCache } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";

// Circuit breaker: once Dhan returns 401 (expired token), stop calling for 10 min.
// Prevents hammering the API and triggering 429 bans.
export let dhanAuthBlockedUntil = 0;
export const AUTH_BLOCK_MS = 10 * 60_000;

export function isDhanAuthBlocked() { return Date.now() < dhanAuthBlockedUntil; }
export function blockDhanAuth() { dhanAuthBlockedUntil = Date.now() + AUTH_BLOCK_MS; }

const AUTH_ERROR = "Option chain requires a connected Dhan broker account.";

/** GET /api/v1/market/option-chain?symbol=RELIANCE&display=RELIANCE&ltp=2500 */
export async function GET(req: NextRequest) {
  if (isDhanAuthBlocked()) {
    return NextResponse.json({ ok: false, error: AUTH_ERROR, data: null, authRequired: true });
  }

  try {
    const { searchParams } = new URL(req.url);
    const tradingSymbol = searchParams.get("symbol") ?? "";
    const display = searchParams.get("display") ?? tradingSymbol;
    const spot = searchParams.get("ltp");
    const expiry = searchParams.get("expiry") ?? undefined;

    const underlying = optionUnderlyingKey(tradingSymbol, display);
    if (!underlying) {
      return NextResponse.json({
        ok: false,
        error: "Option chain is available for indices and equity symbols only.",
        data: null,
      });
    }

    const profile = searchParams.get("profile") === "1";
    const cacheKey = `oc-init:${underlying}:${expiry ?? "near"}:${profile ? "p" : "s"}`;
    const chain = await withSWRCache(
      cacheKey,
      45_000,
      3 * 60_000,
      // Check circuit breaker inside fn so background SWR refreshes also bail early
      () => {
        if (isDhanAuthBlocked()) throw new Error(AUTH_ERROR);
        return getOptionChain(underlying, spot ? Number(spot) : undefined, expiry, { profile });
      },
    );
    return NextResponse.json({ ok: true, data: chain });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v1/market/option-chain]", msg);
    const is401 = /401|Unauthorized|invalid token|808/i.test(msg);
    const is429 = /429|Too Many Requests|805/i.test(msg);
    if (is401 || is429) blockDhanAuth();
    const userMsg = is401 ? AUTH_ERROR
      : is429 ? "Option chain temporarily unavailable — too many requests."
      : msg;
    return NextResponse.json({ ok: false, error: userMsg, data: null, authRequired: is401, rateLimited: is429 });
  }
}

