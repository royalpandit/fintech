import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Compute trailing returns for mutual-fund schemes from mfapi.in's free
// historical-NAV feed. Per-scheme cached for 6h (NAV updates once a day).
type Returns = { r3m: number | null; r6m: number | null; r1y: number | null };

const cache = new Map<string, { data: Returns; at: number }>();
const TTL = 6 * 60 * 60 * 1000;

function parseDate(s: string): number {
  // "dd-mm-yyyy" -> ms
  const [d, m, y] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function navAt(rows: { date: string; nav: string }[], cutoff: number): number | null {
  // rows are newest-first; find the first entry on/before the cutoff date.
  for (const row of rows) {
    if (parseDate(row.date) <= cutoff) {
      const n = parseFloat(row.nav);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

async function returnsFor(code: string): Promise<Returns> {
  const cached = cache.get(code);
  if (cached && Date.now() - cached.at < TTL) return cached.data;

  const empty: Returns = { r3m: null, r6m: null, r1y: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(`https://api.mfapi.in/mf/${code}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return empty;
    const j = (await res.json()) as { data?: { date: string; nav: string }[] };
    const rows = j.data ?? [];
    if (!rows.length) return empty;

    const latest = parseFloat(rows[0].nav);
    if (!Number.isFinite(latest) || latest <= 0) return empty;
    const now = Date.now();
    const month = 30 * 86_400_000;
    const pct = (old: number | null) =>
      old && old > 0 ? Number((((latest - old) / old) * 100).toFixed(2)) : null;

    const data: Returns = {
      r3m: pct(navAt(rows, now - 3 * month)),
      r6m: pct(navAt(rows, now - 6 * month)),
      r1y: pct(navAt(rows, now - 12 * month)),
    };
    cache.set(code, { data, at: Date.now() });
    return data;
  } catch {
    return empty;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const codesParam = new URL(req.url).searchParams.get("codes") ?? "";
  const codes = codesParam
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^\d+$/.test(c))
    .slice(0, 60);

  if (!codes.length) return ok({ returns: {} });

  const results = await mapLimit(codes, 8, returnsFor);
  const returns: Record<string, Returns> = {};
  codes.forEach((c, idx) => {
    returns[c] = results[idx];
  });
  return ok({ returns });
}
