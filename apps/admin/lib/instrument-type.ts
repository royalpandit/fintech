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

/**
 * Exchange marker for a mutual fund.
 *
 * Not a real exchange — funds are bought from the AMC, not a market — but the
 * paper-order path keys pricing off `exchange`, and this is the value that
 * routes an order to the AMFI NAV instead of the Dhan quote feed.
 *
 * It lives here rather than beside that pricing code because Buy/Sell buttons
 * are client components and lib/paper-market-quote.ts reaches lib/dhan.ts,
 * which is `server-only`.
 */
export const MF_EXCHANGE = "MF";

export function isMutualFundExchange(exchange?: string | null): boolean {
  return norm(exchange) === MF_EXCHANGE;
}

/**
 * Does this paper-trade symbol look like an AMFI scheme code?
 *
 * Fund positions are stored under the scheme code, because that is the only
 * stable identifier AMFI publishes. Trades carry no instrument type, so this is
 * how a holding is recognised as a fund after the fact — safe because scheme
 * codes are all digits and no NSE/BSE ticker is.
 */
export function isMutualFundSymbol(symbol?: string | null): boolean {
  return /^\d{4,8}$/.test((symbol ?? "").trim());
}
