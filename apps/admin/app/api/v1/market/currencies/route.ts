import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Currency rates vs INR via open.er-api.com (free, no key). Cached.
// Pair list is dynamic from the feed; known display names when available.
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
  HKD: "Hong Kong Dollar",
  NZD: "New Zealand Dollar",
  KRW: "South Korean Won",
  THB: "Thai Baht",
  MYR: "Malaysian Ringgit",
  SAR: "Saudi Riyal",
  QAR: "Qatari Riyal",
  KWD: "Kuwaiti Dinar",
  BHD: "Bahraini Dinar",
  OMR: "Omani Rial",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  PLN: "Polish Zloty",
  TRY: "Turkish Lira",
  ZAR: "South African Rand",
  BRL: "Brazilian Real",
  MXN: "Mexican Peso",
  RUB: "Russian Ruble",
  IDR: "Indonesian Rupiah",
  PHP: "Philippine Peso",
  VND: "Vietnamese Dong",
  TWD: "New Taiwan Dollar",
};

/** Prefer these when the feed returns many codes; still include any extras with a name. */
const PRIORITY = [
  "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CNY", "AED", "SGD", "CHF",
  "HKD", "NZD", "KRW", "SAR", "THB", "MYR", "SEK", "NOK", "ZAR", "BRL",
];

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

    const codes = Object.keys(inrRates).filter((c) => c !== "INR" && Number.isFinite(inrRates[c]) && inrRates[c] > 0);
    const prioritySet = new Set(PRIORITY);
    const ordered = [
      ...PRIORITY.filter((c) => codes.includes(c)),
      ...codes.filter((c) => !prioritySet.has(c)).sort(),
    ];

    const rates: Rate[] = ordered.map((c) => ({
      code: c,
      name: NAMES[c] ?? c,
      perInr: inrRates[c],
      // 1 unit of foreign currency in INR.
      inrValue: 1 / inrRates[c],
    }));
    if (rates.length) cache = { data: rates, at: Date.now() };
    return ok({ rates, source: "open.er-api.com", base: "INR" });
  } catch {
    if (cache) return ok({ rates: cache.data, stale: true });
    return err("Couldn't reach the currency data source.", 502);
  }
}
