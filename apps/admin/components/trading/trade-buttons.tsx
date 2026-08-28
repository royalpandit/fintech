"use client";

import Link from "next/link";

/**
 * Buy / Sell shortcut for a symbol, shown next to quotes in Markets and the
 * Watchlist.
 *
 * It deep-links into the existing paper-trade form rather than placing an order
 * itself — /user/virtual-trading reads ?symbol= and ?side= and pre-fills them.
 * That keeps a single order path (lib/paper-order-engine.ts) instead of a second
 * one embedded in a list row, and it means the confirmation, balance check and
 * error handling the form already does still apply.
 *
 * The label says "virtual" on purpose. These sit beside live NSE prices, and a
 * bare green BUY next to a real quote reads as a real brokerage order. Every
 * trade here is paper money.
 */
/**
 * Which instruments the paper engine can actually fill.
 *
 * lib/paper-market-quote.ts resolves a symbol through AngelOne, defaulting to
 * exchange NSE and preferring instrumentType EQ, then INDEX. Anything outside
 * that throws `Unknown symbol "X" — pick one from search` at order time, so
 * showing Buy/Sell on it would be an affordance that always fails:
 *
 *   crypto        not on the NSE feed at all
 *   mutual funds  NAV-based units, not an intraday LTP — "Invest"/SIP, not Buy
 *   IPO           not tradable until listing — the action is "Apply"
 *   currencies    CDS segment; commodities MCX — the engine only asks NSE
 *
 * Equities and ETFs are both EQ on NSE. Indices are included because the engine
 * does resolve INDEX and the product already treats them as paper-tradable
 * (NIFTY 50 ships as a default watchlist row) — worth revisiting, since you
 * cannot buy an index in the cash market.
 */
const TRADABLE_TYPES = new Set(["", "EQ", "ETF", "INDEX"]);
const TRADABLE_EXCHANGES = new Set(["", "NSE", "BSE"]);

export function isPaperTradable(instrumentType?: string | null, exchange?: string | null): boolean {
  return (
    TRADABLE_TYPES.has((instrumentType ?? "").trim().toUpperCase()) &&
    TRADABLE_EXCHANGES.has((exchange ?? "").trim().toUpperCase())
  );
}

export default function TradeButtons({
  symbol,
  instrumentType,
  exchange,
  size = "sm",
  className = "",
}: {
  symbol: string;
  /** EQ / ETF / INDEX … — anything else hides the buttons. */
  instrumentType?: string | null;
  /** NSE / BSE — other segments hide the buttons. */
  exchange?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) return null;
  if (!isPaperTradable(instrumentType, exchange)) return null;

  const href = (side: "buy" | "sell") =>
    `/user/virtual-trading?symbol=${encodeURIComponent(sym)}&side=${side}`;

  return (
    <span className={`trade-btns trade-btns--${size} ${className}`.trim()}>
      <Link
        href={href("buy")}
        className="trade-btn trade-btn--buy"
        title={`Buy ${sym} with virtual funds`}
        aria-label={`Buy ${sym} with virtual funds`}
      >
        B<span className="trade-btn-full">uy</span>
      </Link>
      <Link
        href={href("sell")}
        className="trade-btn trade-btn--sell"
        title={`Sell ${sym} with virtual funds`}
        aria-label={`Sell ${sym} with virtual funds`}
      >
        S<span className="trade-btn-full">ell</span>
      </Link>
    </span>
  );
}
