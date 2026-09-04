"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiArrowUpRight, FiArrowDownRight } from "react-icons/fi";
import TradeButtons from "@/components/trading/trade-buttons";
import { LoadingRows } from "@/components/loading-shimmer";

export type MarketRow = {
  symbol: string;
  token: string;
  exchange: string;
  type: string;
  ltp: number;
  netChange: number;
  percentChange: number;
  week52High: number | null;
  week52Low: number | null;
};

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function chartHref(r: MarketRow) {
  const p = new URLSearchParams({ symbol: r.symbol, token: r.token, exchange: r.exchange, type: r.type });
  return `/user/markets/chart?${p.toString()}`;
}

function Panel({
  icon,
  title,
  children,
  note,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <article className="mkt-panel">
      <div className="mkt-panel-head">
        <span className="mkt-panel-icon" aria-hidden>
          {icon}
        </span>
        <h3 className="mkt-panel-title">{title}</h3>
        {note && <span className="mkt-panel-note">{note}</span>}
      </div>
      {children}
    </article>
  );
}

/**
 * Loading and empty are different states and must look different.
 *
 * Every panel here used to fall back to a shimmer whenever its list was empty,
 * so a source that legitimately returned nothing shimmered forever, promising
 * data that was never coming. The Near 52-Week panels sat like that
 * permanently, because the Dhan quote mapping was reading the wrong key names
 * and every 52-week value came back null (see lib/dhan.ts).
 */
function PanelState({ loading, message }: { loading: boolean; message: string }) {
  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <LoadingRows rows={4} />
      </div>
    );
  }
  return <p className="mkt-panel-empty">{message}</p>;
}

/**
 * Where the last price sits inside the 52-week band, 0 (at the low) to 1 (at
 * the high). Null when either bound is missing or the band has no width, so
 * the caller can leave the bar out rather than draw a meaningless full bar.
 */
function rangePosition(r: MarketRow): number | null {
  const lo = r.week52Low;
  const hi = r.week52High;
  if (lo == null || hi == null || !r.ltp || hi <= lo) return null;
  return Math.min(1, Math.max(0, (r.ltp - lo) / (hi - lo)));
}

function StockRow({ r, showRange = false }: { r: MarketRow; showRange?: boolean }) {
  const pos = r.percentChange >= 0;
  const at = showRange ? rangePosition(r) : null;

  return (
    /* Two stacked lines, not one tall flex row. With the range bar nested in
       the left column the symbol, the price and the Buy/Sell pair each sat on
       a different vertical centre. The top line now holds everything that has
       to align; the bar spans underneath it. */
    <div className="mkt-row">
      <div className="mkt-row-top">
        <Link href={chartHref(r)} className="mkt-row-link">
          <span className="mkt-row-sym">{r.symbol}</span>
          <span className="mkt-row-right">
            <span className="mkt-row-ltp">₹{inr(r.ltp)}</span>
            <span className={`mkt-chg ${pos ? "up" : "down"}`}>
              {pos ? <FiArrowUpRight size={12} /> : <FiArrowDownRight size={12} />}
              {pos ? "+" : ""}{r.percentChange.toFixed(2)}%
            </span>
          </span>
        </Link>
        {/* Hidden automatically for anything the paper engine can't fill. */}
        <span className="mkt-row-trade">
          <TradeButtons symbol={r.symbol} instrumentType={r.type} exchange={r.exchange} price={r.ltp} />
        </span>
      </div>

      {/* The whole point of these two panels is "how close to the edge of the
          year is this?" — a price alone does not answer that. */}
      {at !== null && (
        <div
          className="mkt-range"
          title={`52-week range ₹${inr(r.week52Low!)} – ₹${inr(r.week52High!)}`}
        >
          <span className="mkt-range-track">
            <span className="mkt-range-dot" style={{ left: `${at * 100}%` }} />
          </span>
          <span className="mkt-range-ends">
            <span>₹{inr(r.week52Low!)}</span>
            <span>₹{inr(r.week52High!)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

type FiiRow = { date: string; category: string; buyValue: number; sellValue: number; netValue: number };
type DealRow = { date: string; symbol: string; name: string; client: string; buySell: string; quantity: number; avgPrice: number; dealType: string };

function FiiDiiPanel() {
  const [rows, setRows] = useState<FiiRow[]>([]);
  const [error, setError] = useState("");
  // "Finished" is not the same as "has rows" — without this an empty-but-
  // successful response shimmers forever.
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/market/fii-dii", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.ok) setRows(j.rows ?? []);
        else setError(j.error || "Unavailable");
      })
      .catch(() => alive && setError("Network error"))
      .finally(() => alive && setDone(true));
    return () => {
      alive = false;
    };
  }, []);
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return (
    <Panel icon="🏦" title="FII / DII Activity" note="NSE after close">
      {!rows.length ? (
        <PanelState loading={!error && !done} message={error || "No activity published yet."} />
      ) : (
        /* Two values, not a list. As table rows they read as a fragment of a
           bigger table that never arrives; as tiles they read as the headline
           flow numbers they actually are, and buy/sell gives the net context. */
        <div className="mkt-flow-grid">
          {rows.slice(0, 4).map((r, i) => {
            const pos = r.netValue >= 0;
            return (
              <div key={`${r.category}-${i}`} className="mkt-flow" data-dir={pos ? "up" : "down"}>
                <span className="mkt-flow-label">{r.category || "—"}</span>
                <span className={`mkt-flow-value ${pos ? "up" : "down"}`}>
                  {pos ? "+" : ""}₹{fmt(r.netValue)}
                  <span className="mkt-flow-unit">Cr</span>
                </span>
                <span className="mkt-flow-legs">
                  Bought ₹{fmt(r.buyValue)} · Sold ₹{fmt(r.sellValue)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function BulkDealsPanel() {
  const [rows, setRows] = useState<DealRow[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/market/bulk-deals", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.ok) setRows(j.rows ?? []);
        else setError(j.error || "Unavailable");
      })
      .catch(() => alive && setError("Network error"))
      .finally(() => alive && setDone(true));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Panel icon="🧾" title="Bulk & Block Deals" note="NSE">
      {!rows.length ? (
        <PanelState loading={!error && !done} message={error || "No bulk or block deals today."} />
      ) : (
        rows.slice(0, 7).map((r, i) => {
          const buy = /buy/i.test(r.buySell);
          return (
            <div key={`${r.symbol}-${i}`} className="mkt-deal">
              <span className={`mkt-deal-side ${buy ? "buy" : "sell"}`}>{buy ? "B" : "S"}</span>
              <span className="mkt-deal-main">
                <span className="mkt-deal-sym">{r.symbol}</span>
                <span className="mkt-deal-client">{r.client || r.name || "—"}</span>
              </span>
              <span className="mkt-deal-right">
                <span className="mkt-deal-qty">{r.quantity.toLocaleString("en-IN")}</span>
                {r.avgPrice ? <span className="mkt-deal-px">@ ₹{inr(r.avgPrice)}</span> : null}
              </span>
            </div>
          );
        })
      )}
    </Panel>
  );
}

export default function MarketsAllView({
  stocks,
  indices = [],
  loading = false,
}: {
  stocks: MarketRow[];
  /** Index quotes for the strip at the top of the tab. */
  indices?: MarketRow[];
  /** Passed down so a panel can tell "still fetching" from "nothing to show". */
  loading?: boolean;
}) {
  const trending = [...stocks].sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)).slice(0, 5);
  const nearHigh = stocks
    .filter((s) => s.week52High && s.ltp)
    .sort((a, b) => b.ltp / (b.week52High || 1) - a.ltp / (a.week52High || 1))
    .slice(0, 5);
  const nearLow = stocks
    .filter((s) => s.week52Low && s.ltp)
    .sort((a, b) => a.ltp / (a.week52Low || 1) - b.ltp / (b.week52Low || 1))
    .slice(0, 5);

  return (
    <>
      {/* The landing tab used to open on five identically sized list panels
          with no answer to "how is the market today". The indices were only on
          the Stocks tab; they belong here, at the top, as the page's anchor. */}
      {indices.length > 0 && (
        <div className="mkt-index-grid">
          {indices.map((idx) => {
            const pos = idx.percentChange >= 0;
            return (
              <Link
                key={idx.token}
                href={chartHref(idx)}
                className="mkt-index-card"
                data-dir={pos ? "up" : "down"}
              >
                <div className="mkt-index-sym">{idx.symbol}</div>
                <div className="mkt-index-ltp">{inr(idx.ltp)}</div>
                <div className={`mkt-chg ${pos ? "up" : "down"}`}>
                  {pos ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
                  {idx.netChange >= 0 ? "+" : ""}
                  {inr(idx.netChange)} ({idx.percentChange >= 0 ? "+" : ""}
                  {idx.percentChange.toFixed(2)}%)
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Three columns that each stack their own cards, rather than one grid
          holding all five.

          A single grid ties every card in a row to the tallest card in that
          row, so a five-row panel beside a two-row panel left a block of dead
          space and the gaps stopped looking uniform. Columns break that
          coupling: every gap is exactly one `gap` value, whatever the cards
          happen to contain. Trending leads because it is what people came for. */}
      <div className="mkt-all-grid">
        <div className="mkt-col">
          <Panel icon="🔥" title="Trending Stocks" note="most active by % move">
            {trending.length ? (
              trending.map((r) => <StockRow key={r.token} r={r} />)
            ) : (
              <PanelState loading={loading} message="No quotes available right now." />
            )}
          </Panel>
          <FiiDiiPanel />
          <BulkDealsPanel />
        </div>

        {/* High and Low sit in their own columns so the two read side by side —
            they are a pair, and stacking them made the comparison vertical. */}
        <div className="mkt-col">
          <Panel icon="📈" title="Near 52-Week High" note="top 5">
            {nearHigh.length ? (
              nearHigh.map((r) => <StockRow key={r.token} r={r} showRange />)
            ) : (
              <PanelState loading={loading} message="52-week levels unavailable for these symbols." />
            )}
          </Panel>
        </div>

        <div className="mkt-col">
          <Panel icon="📉" title="Near 52-Week Low" note="top 5">
            {nearLow.length ? (
              nearLow.map((r) => <StockRow key={r.token} r={r} showRange />)
            ) : (
              <PanelState loading={loading} message="52-week levels unavailable for these symbols." />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
