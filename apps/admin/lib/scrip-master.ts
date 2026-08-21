import "server-only";

import { loadMarketSnapshot, saveMarketSnapshot } from "@/lib/market-snapshot-store";

export type ScripRow = {
  token: string;
  symbol: string;
  name: string;
  expiry: string;
  strike: string;
  lotsize: string;
  instrumenttype: string;
  exch_seg: string;
  tick_size: string;
};

export type EtfRow = {
  symbol: string;
  name: string;
  token: string;
  exchange: string;
  instrumentType: string;
};

const MASTER_URL =
  process.env.ANGELONE_SCRIP_MASTER_URL ||
  "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

const SNAPSHOT_KIND = "etf-scrip-master";
const TTL_MS = 20 * 60 * 60 * 1000;

let masterCache: { rows: ScripRow[]; at: number } | null = null;
let inflight: Promise<ScripRow[]> | null = null;

function asRow(raw: Record<string, unknown>): ScripRow {
  return {
    token: String(raw.token ?? raw.symboltoken ?? ""),
    symbol: String(raw.symbol ?? ""),
    name: String(raw.name ?? ""),
    expiry: String(raw.expiry ?? ""),
    strike: String(raw.strike ?? ""),
    lotsize: String(raw.lotsize ?? ""),
    instrumenttype: String(raw.instrumenttype ?? raw.instrument_type ?? ""),
    exch_seg: String(raw.exch_seg ?? raw.exchSeg ?? ""),
    tick_size: String(raw.tick_size ?? ""),
  };
}

export function isEtf(row: ScripRow): boolean {
  const exch = row.exch_seg.toUpperCase();
  if (exch !== "NSE" && exch !== "BSE") return false;
  const type = row.instrumenttype.toUpperCase();
  if (type.includes("OPT") || type.includes("FUT")) return false;
  const hay = `${type} ${row.symbol} ${row.name}`.toUpperCase();
  if (/\bETF\b/.test(hay) || type.includes("ETF")) return true;
  return /BEES|IETF|GOLDSHARE|SETFNIF|SETFNN|MON100|ICICINIFTY|NIFTYIETF|NEXT50/.test(hay);
}

// Observed 46s and 77s on consecutive runs for the same 34.7 MB file, so a
// timeout anywhere near a minute aborts the job roughly half the time.
const DOWNLOAD_TIMEOUT_MS = 240_000;

async function downloadMaster(): Promise<ScripRow[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(MASTER_URL, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`scrip master HTTP ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(json) || !json.length) throw new Error("scrip master empty");
    return json.map(asRow).filter((r) => r.token && r.symbol);
  } finally {
    clearTimeout(timer);
  }
}

export async function getScripMaster(force = false): Promise<ScripRow[]> {
  if (!force && masterCache && Date.now() - masterCache.at < TTL_MS) return masterCache.rows;
  if (inflight) return inflight;

  inflight = (async () => {
    const rows = await downloadMaster();
    masterCache = { rows, at: Date.now() };
    const etfs = extractEtfs(rows);
    await saveMarketSnapshot(SNAPSHOT_KIND, {
      count: rows.length,
      etfs,
      downloadedAt: new Date().toISOString(),
    });
    return rows;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function extractEtfs(rows: ScripRow[]): EtfRow[] {
  const seen = new Set<string>();
  const out: EtfRow[] = [];
  for (const r of rows) {
    if (!isEtf(r)) continue;
    const exchange = r.exch_seg.toUpperCase();
    const key = `${exchange}:${r.token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      symbol: r.symbol.replace(/-EQ$/, ""),
      name: r.name || r.symbol,
      token: r.token,
      exchange,
      instrumentType: r.instrumenttype || "EQ",
    });
  }
  return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

type EtfSnapshot = { etfs?: EtfRow[]; count?: number; downloadedAt?: string };

/**
 * The master is a 34.7 MB JSON that takes ~46s to download, so blocking a page
 * render on it is not viable. Every successful download persists an ETF
 * snapshot, so serve that first and only pay the download when there is
 * genuinely nothing cached. A stale snapshot is still served immediately and
 * refreshed in the background.
 */
let etfMemo: { etfs: EtfRow[]; count: number; source: string; readAt: number } | null = null;
const MEMO_MS = 5 * 60_000;
let bgRefresh: Promise<void> | null = null;

function refreshInBackground(): void {
  if (bgRefresh) return;
  bgRefresh = getScripMaster(true)
    .then(() => {
      etfMemo = null; // next read picks up the fresh snapshot
    })
    .catch((e) => {
      console.warn("[scrip-master] background refresh failed:", e instanceof Error ? e.message : e);
    })
    .finally(() => {
      bgRefresh = null;
    });
}

/**
 * `allowDownload: false` is for request paths — they serve whatever is cached
 * and trigger a background refresh rather than blocking a user for a minute or
 * more on the master download. The cron passes true.
 */
export async function getEtfList(
  force = false,
  opts: { allowDownload?: boolean } = {},
): Promise<{ etfs: EtfRow[]; source: string; count: number }> {
  const allowDownload = opts.allowDownload ?? true;
  if (force) {
    const rows = await getScripMaster(true);
    etfMemo = null;
    return { etfs: extractEtfs(rows), source: "scrip-master", count: rows.length };
  }

  if (etfMemo && Date.now() - etfMemo.readAt < MEMO_MS) {
    return { etfs: etfMemo.etfs, source: etfMemo.source, count: etfMemo.count };
  }

  // Already downloaded in this process — no DB round-trip needed.
  if (masterCache && Date.now() - masterCache.at < TTL_MS) {
    const etfs = extractEtfs(masterCache.rows);
    etfMemo = { etfs, count: masterCache.rows.length, source: "scrip-master", readAt: Date.now() };
    return { etfs, source: "scrip-master", count: masterCache.rows.length };
  }

  const snap = await loadMarketSnapshot<EtfSnapshot>(SNAPSHOT_KIND);
  if (snap?.data?.etfs?.length) {
    const stale = Date.now() - snap.fetchedAt.getTime() > TTL_MS;
    if (stale) refreshInBackground();
    const etfs = snap.data.etfs;
    const count = snap.data.count ?? etfs.length;
    const source = stale ? "snapshot-stale" : "snapshot";
    etfMemo = { etfs, count, source, readAt: Date.now() };
    return { etfs, source, count };
  }

  // Nothing cached at all — first deploy, or the snapshot table is missing.
  if (!allowDownload) {
    refreshInBackground();
    return { etfs: [], source: "warming", count: 0 };
  }
  const rows = await getScripMaster(true);
  const etfs = extractEtfs(rows);
  etfMemo = { etfs, count: rows.length, source: "scrip-master", readAt: Date.now() };
  return { etfs, source: "scrip-master", count: rows.length };
}

/** Cron: GET the master at 08:00 IST. HEAD 404s — never use HEAD. */
export async function refreshScripMaster(): Promise<{ instruments: number; etfs: number }> {
  const rows = await getScripMaster(true);
  return { instruments: rows.length, etfs: extractEtfs(rows).length };
}
