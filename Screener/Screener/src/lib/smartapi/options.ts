import { formatExpiryForApi } from "./scrip-master";
import { smartApiFetch } from "./session";
import type { OptionChainStrike, OptionGreekRow } from "./types";

function parseNum(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function mapGreek(row: OptionGreekRow) {
  return {
    delta: parseNum(row.delta),
    gamma: parseNum(row.gamma),
    theta: parseNum(row.theta),
    vega: parseNum(row.vega),
    iv: parseNum(row.impliedVolatility),
    volume: parseNum(row.tradeVolume),
  };
}

export async function fetchOptionGreeks(
  name: string,
  expirydate: string,
): Promise<OptionGreekRow[]> {
  const formatted = formatExpiryForApi(expirydate);
  return smartApiFetch<OptionGreekRow[]>(
    "/rest/secure/angelbroking/marketData/v1/optionGreek",
    {
      method: "POST",
      body: { name: name.toUpperCase(), expirydate: formatted },
    },
  );
}

function normalizeStrike(raw: number): number {
  // Stock options from Angel often use strike × 100 in scrip/greeks payloads
  if (raw > 50_000) return raw / 100;
  return raw;
}

export function buildOptionChain(rows: OptionGreekRow[]): OptionChainStrike[] {
  const byStrike = new Map<number, OptionChainStrike>();

  for (const row of rows) {
    const strike = normalizeStrike(parseNum(row.strikePrice));
    if (!byStrike.has(strike)) {
      byStrike.set(strike, { strike });
    }
    const entry = byStrike.get(strike)!;
    const greek = mapGreek(row);

    if (row.optionType === "CE") entry.ce = greek;
    if (row.optionType === "PE") entry.pe = greek;
  }

  return Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike);
}
