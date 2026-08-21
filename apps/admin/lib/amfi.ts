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
  /** "Direct Plan" / "Regular Plan" — a separate column since Aug 2026. */
  plan: string;
  /** "Growth" / "IDCW-Payout" / … — likewise. */
  option: string;
  nav: number | null;
  date: string;
};

const AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cache: { data: MutualFund[]; at: number } | null = null;
let inflight: Promise<MutualFund[]> | null = null;

/**
 * AMFI's layout is not fixed. It used to be
 *   code;isin;isinReinvest;name;nav;date
 * and in Aug 2026 two columns (Plan, Option) were inserted before the NAV,
 * which silently turned every NAV into NaN — the whole tab went empty. So read
 * the header row and locate columns by name rather than by position.
 */
const COLUMNS = {
  code: ["scheme code"],
  isin: ["isin div payout/ isin growth", "isin div payout", "isin growth"],
  name: ["scheme name"],
  plan: ["plan"],
  option: ["option"],
  nav: ["net asset value", "nav"],
  date: ["date"],
} as const;

type ColumnMap = Partial<Record<keyof typeof COLUMNS, number>>;

/** Positions used before the Plan/Option columns appeared. */
const LEGACY_COLUMNS: ColumnMap = { code: 0, isin: 1, name: 3, nav: 4, date: 5 };

function parseHeader(line: string): ColumnMap {
  const cells = line.split(";").map((c) => c.trim().toLowerCase());
  const map: ColumnMap = {};
  for (const [field, aliases] of Object.entries(COLUMNS) as [keyof typeof COLUMNS, readonly string[]][]) {
    const idx = cells.findIndex((c) => aliases.includes(c));
    if (idx >= 0) map[field] = idx;
  }
  // A header we can't read is worse than no header — fall back rather than
  // emit rows with fields pulled from the wrong columns.
  if (map.code == null || map.name == null || map.nav == null) return {};
  return map;
}

function parse(text: string): MutualFund[] {
  const funds: MutualFund[] = [];
  let currentAmc = "";
  let currentCategory = "";
  let columns: ColumnMap | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (/^scheme\s+code/i.test(line)) {
      const parsed = parseHeader(line);
      columns = Object.keys(parsed).length ? parsed : LEGACY_COLUMNS;
      continue;
    }

    if (!line.includes(";")) {
      // Standalone line = either a fund house or a scheme-category heading.
      if (/mutual fund/i.test(line)) currentAmc = line;
      else currentCategory = line;
      continue;
    }

    const cols = columns ?? LEGACY_COLUMNS;
    const parts = line.split(";");
    const at = (i: number | undefined) => (i == null ? "" : (parts[i] ?? "").trim());

    const code = at(cols.code);
    if (!/^\d+$/.test(code)) continue;

    const navNum = parseFloat(at(cols.nav));
    funds.push({
      code,
      isin: at(cols.isin),
      name: at(cols.name),
      amc: currentAmc,
      category: currentCategory,
      plan: at(cols.plan),
      option: at(cols.option),
      nav: Number.isFinite(navNum) ? navNum : null,
      date: at(cols.date),
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

  const matches = withNav.filter((f) => {
    const hay = `${f.name} ${f.amc} ${f.plan} ${f.option}`.toLowerCase();
    return hay.includes(query);
  });
  // Prefer name-start matches, then alphabetical.
  matches.sort((a, b) => {
    const as = a.name.toLowerCase().startsWith(query) ? 0 : 1;
    const bs = b.name.toLowerCase().startsWith(query) ? 0 : 1;
    if (as !== bs) return as - bs;
    return a.name.localeCompare(b.name);
  });
  return matches.slice(0, limit);
}
