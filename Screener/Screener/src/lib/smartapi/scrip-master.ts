const SCRIP_MASTER_URL =
  "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

export interface ScripMasterRow {
  token: string;
  symbol: string;
  name: string;
  expiry: string;
  strike: string;
  lotsize: string;
  instrumenttype: string;
  exch_seg: string;
}

let cache: ScripMasterRow[] | null = null;
let cacheAt = 0;
const CACHE_MS = 12 * 60 * 60 * 1000;

export async function getScripMaster(): Promise<ScripMasterRow[]> {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;

  const res = await fetch(SCRIP_MASTER_URL, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Scrip master download failed (HTTP ${res.status})`);
  }

  try {
    cache = JSON.parse(text) as ScripMasterRow[];
  } catch {
    throw new Error(
      "Scrip master returned invalid data. Try again in a few minutes.",
    );
  }
  cacheAt = Date.now();
  return cache;
}

/** Format expiry for optionGreek API e.g. `25JAN2024` */
export function formatExpiryForApi(expiry: string): string {
  if (!expiry) return "";
  if (/^\d{2}[A-Z]{3}\d{4}$/.test(expiry)) return expiry;
  const d = new Date(expiry);
  if (Number.isNaN(d.getTime())) return expiry.toUpperCase();

  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  const day = String(d.getDate()).padStart(2, "0");
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}${month}${year}`;
}

export async function getOptionExpiries(underlying: string): Promise<string[]> {
  const master = await getScripMaster();
  const name = underlying.toUpperCase();

  const expiries = new Set<string>();

  for (const row of master) {
    if (row.exch_seg !== "NFO" && row.exch_seg !== "BFO") continue;
    if (row.name?.toUpperCase() !== name) continue;
    if (!row.expiry) continue;
    const isOption =
      row.instrumenttype === "OPTIDX" ||
      row.instrumenttype === "OPTSTK" ||
      row.symbol?.endsWith("CE") ||
      row.symbol?.endsWith("PE");
    if (!isOption) continue;
    expiries.add(formatExpiryForApi(row.expiry));
  }

  return Array.from(expiries).sort(
    (a, b) => new Date(parseExpiry(a)).getTime() - new Date(parseExpiry(b)).getTime(),
  );
}

function parseExpiry(exp: string): number {
  const m = exp.match(/^(\d{2})([A-Z]{3})(\d{4})$/);
  if (!m) return 0;
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  return new Date(Number(m[3]), months[m[2]] ?? 0, Number(m[1])).getTime();
}
