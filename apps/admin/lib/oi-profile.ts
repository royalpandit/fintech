import type { OptionChainRow } from "@/lib/angelone";
import { formatExpiryLabel } from "@/lib/angelone";

export type OiStrikeProfile = {
  strike: number;
  callOi: number;
  putOi: number;
  callOiChangePct?: number;
  putOiChangePct?: number;
  pcr?: number;
};

export function formatOiIndian(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} Lac`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)} K`;
  return String(Math.round(n));
}

export function formatOiChangePct(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "";
  return `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;
}

export function computePcr(callOi: number, putOi: number): number | undefined {
  if (callOi <= 0) return undefined;
  return putOi / callOi;
}

/** Map option chain rows → strike-level OI profile records. */
export function rowsToOiProfile(rows: OptionChainRow[]): OiStrikeProfile[] {
  const out: OiStrikeProfile[] = [];
  for (const row of rows) {
    const callOi = Math.max(0, row.ce?.oi ?? 0);
    const putOi = Math.max(0, row.pe?.oi ?? 0);
    if (callOi <= 0 && putOi <= 0) continue;
    out.push({
      strike: row.strike,
      callOi,
      putOi,
      callOiChangePct: row.ce?.oiChangePct,
      putOiChangePct: row.pe?.oiChangePct,
      pcr: computePcr(callOi, putOi),
    });
  }
  return out;
}

export function maxOiValues(strikes: OiStrikeProfile[]) {
  let maxCall = 0;
  let maxPut = 0;
  for (const s of strikes) {
    if (s.callOi > maxCall) maxCall = s.callOi;
    if (s.putOi > maxPut) maxPut = s.putOi;
  }
  return { maxCall, maxPut, maxAny: Math.max(maxCall, maxPut, 1) };
}

export function expiryDisplayLabel(expiryCode: string): string {
  return formatExpiryLabel(expiryCode);
}
