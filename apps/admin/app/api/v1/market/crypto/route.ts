import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { fetchJson, firstSuccess, type Provider } from "@/lib/provider-failover";

export const dynamic = "force-dynamic";

// Top crypto by market cap in INR. CoinGecko is the source; a demo key raises
// the rate limit, so we prefer the keyed call and fall back to the keyless one
// if the key is missing, expired or rate-limited.
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

const BASE = process.env.COINGECKO_BASE_URL || "https://api.coingecko.com/api/v3";
const MARKETS = "/coins/markets?vs_currency=inr&order=market_cap_desc&per_page=20&page=1&sparkline=false";

type Row = Record<string, unknown>;

function toCoins(rows: Row[]): Coin[] {
  const coins = rows.map((r) => ({
    id: String(r.id),
    symbol: String(r.symbol ?? "").toUpperCase(),
    name: String(r.name ?? ""),
    image: String(r.image ?? ""),
    price: Number(r.current_price ?? 0),
    change24h: Number(r.price_change_percentage_24h ?? 0),
    marketCap: Number(r.market_cap ?? 0),
  }));
  if (!coins.length) throw new Error("empty payload");
  return coins;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  if (cache && Date.now() - cache.at < TTL) return ok({ coins: cache.data, cached: true });

  const apiKey = process.env.COINGECKO_API_KEY?.trim();

  const providers: Provider<Coin[]>[] = [
    {
      // Preferred: the demo key lifts the limit to ~10k calls/month.
      name: "coingecko-keyed",
      enabled: Boolean(apiKey),
      run: async () =>
        toCoins(
          await fetchJson<Row[]>(`${BASE}${MARKETS}`, {
            headers: { accept: "application/json", "x-cg-demo-api-key": apiKey! },
          }),
        ),
    },
    {
      // Works without a key, just at a lower limit.
      name: "coingecko-public",
      run: async () =>
        toCoins(await fetchJson<Row[]>(`${BASE}${MARKETS}`, { headers: { accept: "application/json" } })),
    },
  ];

  try {
    const { value, provider, failed } = await firstSuccess(providers);
    cache = { data: value, at: Date.now() };
    return ok({ coins: value, provider, ...(failed.length ? { failedOver: failed } : {}) });
  } catch (e) {
    // Serving stale data beats serving nothing on a price board.
    if (cache) return ok({ coins: cache.data, stale: true });
    return err(
      e instanceof Error ? `Couldn't reach the crypto data source (${e.message})` : "Couldn't reach the crypto data source.",
      502,
    );
  }
}
