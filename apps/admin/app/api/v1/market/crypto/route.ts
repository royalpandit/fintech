import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Top crypto by market cap in INR, via CoinGecko's free public API (no key).
// Cached in-memory so we don't hit their rate limit on every poll.
type Coin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  marketCap: number;
};

let cache: { data: Coin[]; at: number } | null = null;
const TTL = 60_000;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  if (cache && Date.now() - cache.at < TTL) return ok({ coins: cache.data });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&order=market_cap_desc&per_page=20&page=1&sparkline=false",
      { signal: controller.signal, cache: "no-store", headers: { accept: "application/json" } },
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const coins: Coin[] = rows.map((r) => ({
      id: String(r.id),
      symbol: String(r.symbol ?? "").toUpperCase(),
      name: String(r.name ?? ""),
      image: String(r.image ?? ""),
      price: Number(r.current_price ?? 0),
      change24h: Number(r.price_change_percentage_24h ?? 0),
      marketCap: Number(r.market_cap ?? 0),
    }));
    if (coins.length) cache = { data: coins, at: Date.now() };
    return ok({ coins });
  } catch {
    if (cache) return ok({ coins: cache.data, stale: true });
    return err("Couldn't reach the crypto data source.", 502);
  }
}
