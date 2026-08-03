// Mutual-fund data via AMFI's free daily NAV feed (no API key required).
// AngelOne carries only exchange-traded instruments, so mutual funds come from
// here. The full NAVAll.txt is ~7MB / ~10k schemes, so we fetch once and cache
// it in-memory for a few hours (NAV publishes once per business day).

export type MutualFund = {
  code: string;
  isin: string;
  name: string;
  amc: string;
  category: string;
  nav: number | null;
  date: string;
};

const AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cache: { data: MutualFund[]; at: number } | null = null;
let inflight: Promise<MutualFund[]> | null = null;

function parse(text: string): MutualFund[] {
  const funds: MutualFund[] = [];
  let currentAmc = "";
  let currentCategory = "";

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("Scheme Code")) continue; // header

    if (!line.includes(";")) {
      // Standalone line = either a fund house or a scheme-category heading.
      if (/mutual fund/i.test(line)) currentAmc = line;
      else currentCategory = line;
      continue;
    }

    const parts = line.split(";");
    if (parts.length < 6) continue;
    const code = parts[0].trim();
    if (!/^\d+$/.test(code)) continue;

    const navNum = parseFloat(parts[4]);
    funds.push({
      code,
      isin: parts[1].trim(),
      name: parts[3].trim(),
      amc: currentAmc,
      category: currentCategory,
      nav: Number.isFinite(navNum) ? navNum : null,
      date: parts[5].trim(),
    });
  }
  return funds;
}

export async function getMutualFunds(): Promise<MutualFund[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;

  inflight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(AMFI_URL, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`AMFI responded ${res.status}`);
      const text = await res.text();
      const data = parse(text);
      if (data.length > 0) cache = { data, at: Date.now() };
      return cache?.data ?? data;
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
  })();

  return inflight;
}

export async function searchMutualFunds(q: string, limit = 50): Promise<MutualFund[]> {
  const all = await getMutualFunds();
  const query = q.trim().toLowerCase();

  // Only rank funds that actually have a NAV (skip stale/merged schemes).
  const withNav = all.filter((f) => f.nav != null);

  if (query.length < 2) {
    // Browse default: a stable alphabetical slice so the tab isn't empty.
    return [...withNav].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  }

  const matches = withNav.filter(
    (f) => f.name.toLowerCase().includes(query) || f.amc.toLowerCase().includes(query),
  );
  // Prefer name-start matches, then alphabetical.
  matches.sort((a, b) => {
    const as = a.name.toLowerCase().startsWith(query) ? 0 : 1;
    const bs = b.name.toLowerCase().startsWith(query) ? 0 : 1;
    if (as !== bs) return as - bs;
    return a.name.localeCompare(b.name);
  });
  return matches.slice(0, limit);
}
