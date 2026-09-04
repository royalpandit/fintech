"use client";

import { useRef, useState } from "react";
import TradeDialog from "@/components/trading/trade-dialog";
import { isEquityInstrument, isIndexInstrument } from "@/lib/instrument-type";

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

 * Equities and ETFs both trade as equity on NSE. Indices are included because
 * the engine does resolve INDEX and the product already treats them as
 * paper-tradable (NIFTY 50 ships as a default watchlist row) - worth
 * revisiting, since you cannot buy an index in the cash market.
 *
 * The equity/index checks go through lib/instrument-type so both provider
 * vocabularies match. A literal "EQ" set silently dropped the buttons from
 * anything Dhan labels "EQUITY" - which is every row added from live search,
 * so Buy/Sell showed on some watchlist rows and not others for no visible
 * reason. "ETF" stays an explicit extra: it is a UI-side label, not a
 * provider one.
 */
const EXTRA_TRADABLE_TYPES = new Set(["", "ETF"]);
const TRADABLE_EXCHANGES = new Set(["", "NSE", "BSE"]);

export function isPaperTradable(instrumentType?: string | null, exchange?: string | null): boolean {
  const t = (instrumentType ?? "").trim().toUpperCase();
  const typeOk = EXTRA_TRADABLE_TYPES.has(t) || isEquityInstrument(t) || isIndexInstrument(t);
  return typeOk && TRADABLE_EXCHANGES.has((exchange ?? "").trim().toUpperCase());
}

/**
 * Where a Buy/Sell click should land, for the panel it was clicked in.
 *
 * This used to be a hardcoded /user/virtual-trading. Markets and the Watchlist
 * are rendered in the advisor console too, and app/user/layout.tsx redirects
 * advisors out by role — so every Buy/Sell button on the advisor side pointed
 * at a page that bounced them straight back.
 *
 * The Buy/Sell buttons themselves no longer navigate — they open TradeDialog
 * in place. This stays exported for the callers that still need a destination
 * (the watchlist row menu falls back to it when a full page is wanted).
 */
export function paperTradeBase(pathname: string | null): string {
  return pathname?.startsWith("/advisor") ? "/advisor/paper" : "/user/virtual-trading";
}

export default function TradeButtons({
  symbol,
  instrumentType,
  exchange,
  price,
  size = "sm",
  className = "",
}: {
  symbol: string;
  /** EQ / ETF / INDEX … — anything else hides the buttons. */
  instrumentType?: string | null;
  /** NSE / BSE — other segments hide the buttons. */
  exchange?: string | null;
  /** Last traded price, when the caller has it — lets the popover show an
   *  order estimate without a second quote request. */
  price?: number | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState<"buy" | "sell" | null>(null);
  // The popover points at this, and re-measures it on scroll.
  const anchorRef = useRef<HTMLSpanElement>(null);
  const sym = (symbol ?? "").trim().toUpperCase();

  if (!sym) return null;
  if (!isPaperTradable(instrumentType, exchange)) return null;

  return (
    <>
      <span ref={anchorRef} className={`trade-btns trade-btns--${size} ${className}`.trim()}>
        <button
          type="button"
          className="trade-btn trade-btn--buy"
          title={`Buy ${sym} with virtual funds`}
          aria-label={`Buy ${sym} with virtual funds`}
          onClick={() => setOpen((v) => (v === "buy" ? null : "buy"))}
        >
          B<span className="trade-btn-full">uy</span>
        </button>
        <button
          type="button"
          className="trade-btn trade-btn--sell"
          title={`Sell ${sym} with virtual funds`}
          aria-label={`Sell ${sym} with virtual funds`}
          onClick={() => setOpen((v) => (v === "sell" ? null : "sell"))}
        >
          S<span className="trade-btn-full">ell</span>
        </button>
      </span>

      {open && (
        <TradeDialog
          symbol={sym}
          side={open}
          price={price}
          exchange={exchange}
          anchor={anchorRef.current}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
