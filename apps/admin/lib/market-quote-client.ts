/** Client-side helpers for /api/v1/market/live (always includes preset indices first). */

export type LiveQuoteRow = {
  symbolToken?: string;
  ltp?: number;
  percentChange?: number;
};

export function pickLiveQuote(
  rows: LiveQuoteRow[] | undefined,
  token: string,
): LiveQuoteRow | null {
  if (!rows?.length || !token) return null;
  return rows.find((q) => String(q.symbolToken) === String(token)) ?? null;
}

export function inferInstrumentType(tradingSymbol: string, instrumentType?: string): string {
  if (instrumentType) return instrumentType;
  const sym = tradingSymbol.toUpperCase();
  if (sym.endsWith("-EQ") || sym.endsWith("-BE") || sym.endsWith("-BL")) return "EQ";
  if (sym.endsWith("CE") || sym.endsWith("PE")) return "OPT";
  if (sym.includes("FUT")) return "FUT";
  if (/^999\d+/.test(sym)) return "INDEX";
  return "EQ";
}

export async function fetchLiveQuote(params: {
  token: string;
  exchange: string;
  tradingSymbol: string;
  instrumentType?: string;
}): Promise<{ ltp: number; changePct: number } | null> {
  const { token, exchange, tradingSymbol, instrumentType } = params;
  if (!token) return null;
  try {
    const typ = inferInstrumentType(tradingSymbol, instrumentType);
    const extra = `${token}:${exchange}:${encodeURIComponent(tradingSymbol)}:${typ}`;
    const res = await fetch(`/api/v1/market/live?extra=${extra}`, { cache: "no-store" });
    const json = await res.json();
    if (!json.ok) return null;
    const row = pickLiveQuote(json.data, token);
    if (!row?.ltp || Number(row.ltp) <= 0) return null;
    return {
      ltp: Number(row.ltp),
      changePct: Number(row.percentChange ?? 0),
    };
  } catch {
    return null;
  }
}
