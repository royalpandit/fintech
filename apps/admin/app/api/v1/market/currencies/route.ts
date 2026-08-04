import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Major currency rates vs INR, via open.er-api.com (free, no key). Cached.
type Rate = { code: string; name: string; perInr: number; inrValue: number };

const NAMES: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  AUD: "Australian Dollar",
  CAD: "Canadian Dollar",
  CNY: "Chinese Yuan",
  AED: "UAE Dirham",
  SGD: "Singapore Dollar",
  CHF: "Swiss Franc",
};

let cache: { data: Rate[]; at: number } | null = null;
const TTL = 10 * 60_000;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  if (cache && Date.now() - cache.at < TTL) return ok({ rates: cache.data });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch("https://open.er-api.com/v6/latest/INR", {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`forex ${res.status}`);
    const j = (await res.json()) as { rates?: Record<string, number> };
    const inrRates = j.rates ?? {};
    const rates: Rate[] = Object.keys(NAMES)
      .filter((c) => inrRates[c])
      .map((c) => ({
        code: c,
        name: NAMES[c],
        perInr: inrRates[c],
        // 1 unit of foreign currency in INR.
        inrValue: inrRates[c] ? 1 / inrRates[c] : 0,
      }));
    if (rates.length) cache = { data: rates, at: Date.now() };
    return ok({ rates });
  } catch {
    if (cache) return ok({ rates: cache.data, stale: true });
    return err("Couldn't reach the currency data source.", 502);
  }
}
