/**
 * Instrument-type predicates that understand both market-data vocabularies.
 *
 * The market feed moved from Angel One to Dhan, and the two label instruments
 * differently:
 *
 *   Angel One   EQ        INDEX   FUT                OPT
 *   Dhan        EQUITY    INDEX   FUTSTK / FUTIDX    OPTSTK / OPTIDX
 *
 * Only INDEX is spelled the same. Everything comparing `instrumentType === "EQ"`
 * kept compiling after the swap and silently stopped matching — most seriously
 * in the paper-trade symbol resolver, where the equity branch fell through to
 * the first fuzzy search hit, so an order could be priced against a different
 * security with no error.
 *
 * These live in one dependency-free module so the mapping can't drift again,
 * and so a future provider change is a single edit rather than a hunt through
 * scattered string comparisons.
 */

function norm(t?: string | null): string {
  return (t ?? "").trim().toUpperCase();
}

/** Cash-market equity (includes ETFs, which trade as equity on NSE/BSE). */
export function isEquityInstrument(instrumentType?: string | null): boolean {
  const t = norm(instrumentType);
  return t === "EQ" || t === "EQUITY";
}

/** An index level (NIFTY 50, BANKNIFTY). Same word in both providers. */
export function isIndexInstrument(instrumentType?: string | null): boolean {
  return norm(instrumentType) === "INDEX";
}

/** Futures on a stock or an index. */
export function isFutureInstrument(instrumentType?: string | null): boolean {
  const t = norm(instrumentType);
  return t === "FUT" || t === "FUTSTK" || t === "FUTIDX";
}

/** Options on a stock or an index. */
export function isOptionInstrument(instrumentType?: string | null): boolean {
  const t = norm(instrumentType);
  return t === "OPT" || t === "OPTSTK" || t === "OPTIDX";
}
