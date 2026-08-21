import "server-only";

import { nseGetJson, nsePath } from "@/lib/nse-client";
import { istDateDDMMYYYY } from "@/lib/nse-market-time";
import { loadMarketSnapshot, saveMarketSnapshot } from "@/lib/market-snapshot-store";

export type FiiDiiRow = {
  date: string;
  category: string;
  buyValue: number;
  sellValue: number;
  netValue: number;
};

export type BulkDealRow = {
  date: string;
  symbol: string;
  name: string;
  client: string;
  buySell: string;
  quantity: number;
  avgPrice: number;
  dealType: string;
};

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["data", "DATAGRD", "equity", "fiiDii"]) {
      if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
    }
  }
  return [];
}

function mapFii(r: Record<string, unknown>): FiiDiiRow {
  return {
    date: String(r.date ?? r.tradingDate ?? r.Date ?? ""),
    category: String(r.category ?? r.Category ?? r.cat ?? ""),
    buyValue: num(r.buyValue ?? r.buyVal ?? r.buyvalue),
    sellValue: num(r.sellValue ?? r.sellVal ?? r.sellvalue),
    netValue: num(r.netValue ?? r.netVal ?? r.netvalue),
  };
}

function mapDeal(r: Record<string, unknown>): BulkDealRow {
  return {
    date: String(r.date ?? r.BD_DT_DATE ?? r.dealDate ?? ""),
    symbol: String(r.symbol ?? r.BD_SYMBOL ?? r.scripCode ?? ""),
    name: String(r.name ?? r.BD_SCRIP_NAME ?? r.company ?? ""),
    client: String(r.clientName ?? r.BD_CLIENT_NAME ?? r.client ?? ""),
    buySell: String(r.buySell ?? r.BD_BUY_SELL ?? r.side ?? ""),
    quantity: num(r.quantity ?? r.BD_QTY_TRD ?? r.qty),
    avgPrice: num(r.avgPrice ?? r.BD_TP_WATP ?? r.price),
    dealType: String(r.dealType ?? r.type ?? "bulk"),
  };
}

export async function refreshFiiDii(): Promise<{ rows: number }> {
  const url = nsePath("NSE_FII_DII_PATH", "/api/fiidiiTradeReact");
  const raw = await nseGetJson<unknown>(url);
  const rows = rowsOf(raw).map(mapFii).filter((r) => r.category);
  if (!rows.length) throw new Error("FII/DII payload empty");
  await saveMarketSnapshot("fii-dii", { rows, fetchedAt: new Date().toISOString() });
  return { rows: rows.length };
}

function lookbackDates(days = 5): { from: string; to: string } {
  const to = istDateDDMMYYYY();
  const from = istDateDDMMYYYY(Date.now() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

export async function refreshBulkDeals(): Promise<{ rows: number }> {
  const url = nsePath("NSE_BULK_BLOCK_PATH", "/api/historicalOR/bulk-block-short-deals");
  const { from, to } = lookbackDates(4);

  // `optionType` is required — without it NSE answers 500, which is what the
  // card was showing. The panel covers both kinds, so fetch each and merge.
  const kinds: { optionType: string; dealType: string }[] = [
    { optionType: "bulk_deals", dealType: "bulk" },
    { optionType: "block_deals", dealType: "block" },
  ];

  const rows: BulkDealRow[] = [];
  const errors: string[] = [];
  for (const kind of kinds) {
    try {
      const raw = await nseGetJson<unknown>(url, { optionType: kind.optionType, from, to });
      for (const r of rowsOf(raw)) {
        const row = mapDeal(r);
        if (!row.symbol) continue;
        rows.push({ ...row, dealType: kind.dealType });
      }
    } catch (e) {
      errors.push(`${kind.optionType}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Only fail if neither kind came back — one working half is still useful.
  if (!rows.length && errors.length) throw new Error(errors.join("; "));

  rows.sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol));
  await saveMarketSnapshot("bulk-deals", { rows, from, to, fetchedAt: new Date().toISOString() });
  return { rows: rows.length };
}

const SNAPSHOT_FRESH_MS = 6 * 60 * 60 * 1000;

async function readOrRefresh<T>(
  kind: string,
  refresh: () => Promise<unknown>,
  emptyMsg: string,
): Promise<{ rows: T[]; fetchedAt: string | null }> {
  const snap = await loadMarketSnapshot<{ rows: T[]; fetchedAt?: string }>(kind);
  const fresh = snap && Date.now() - snap.fetchedAt.getTime() < SNAPSHOT_FRESH_MS;
  if (!fresh) {
    try {
      await refresh();
    } catch (e) {
      if (!snap) throw e instanceof Error ? e : new Error(emptyMsg);
    }
  }
  const latest = (await loadMarketSnapshot<{ rows: T[]; fetchedAt?: string }>(kind)) ?? snap;
  if (!latest) throw new Error(emptyMsg);
  return {
    rows: latest.data.rows ?? [],
    fetchedAt: latest.data.fetchedAt ?? latest.fetchedAt.toISOString(),
  };
}

export function getFiiDii() {
  return readOrRefresh<FiiDiiRow>("fii-dii", refreshFiiDii, "FII/DII data is not available yet");
}

export function getBulkDeals() {
  return readOrRefresh<BulkDealRow>("bulk-deals", refreshBulkDeals, "Bulk deals data is not available yet");
}
