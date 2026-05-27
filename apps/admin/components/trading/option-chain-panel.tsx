"use client";

import { Children, Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { WatchlistItem } from "./trading-terminal-types";
import { optionUnderlyingKey, type OptionLeg } from "@/lib/angelone";
import MarketDepthModal from "./market-depth-modal";
import OptionOrderSheet from "./option-order-sheet";
import { optionLegToWatchlist } from "./option-leg-utils";

export interface OptionChainData {
  underlying: string;
  exchange: string;
  expiry: string;
  expiries: { code: string; label: string }[];
  spot?: number;
  spotChange?: number;
  spotChangePct?: number;
  rows: OptionChainRow[];
  tokens: { token: string; exchange: string }[];
}

export type { OptionLeg };

export interface OptionChainRow {
  strike: number;
  ce?: OptionLeg;
  pe?: OptionLeg;
}

const SILENT_REFRESH_MS = 6_000;

type LegPick = {
  leg: OptionLeg;
  side: "CE" | "PE";
  strike: number;
};

function fmtP(n: number | undefined) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | undefined) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtCompact(n: number | undefined) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(Math.round(n));
}

function BarCell({ value, max }: { value?: number; max: number }) {
  const pct = value && max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="oc-bar-cell">
      <div className="oc-bar-fill" style={{ width: `${pct}%` }} />
      <span className="oc-bar-val">{fmtCompact(value)}</span>
    </div>
  );
}

function LtpCell({ ltp, pct }: { ltp?: number; pct?: number }) {
  const down = (pct ?? 0) < 0;
  return (
    <div className="oc-ltp-cell">
      <div className="oc-ltp-price">{fmtP(ltp)}</div>
      <div className={down ? "oc-ltp-chg down" : "oc-ltp-chg up"}>({fmtPct(pct)})</div>
    </div>
  );
}

function LegCells({
  leg,
  side,
  strike,
  itm,
  variant,
  pickLeg,
  children,
}: {
  leg?: OptionLeg;
  side: "CE" | "PE";
  strike: number;
  itm: boolean;
  variant: "call" | "put";
  pickLeg: (pick: LegPick, el: HTMLElement) => void;
  children: ReactNode;
}) {
  const cls = `${leg ? "oc-leg-cell " : ""}${itm ? `itm ${variant}` : variant}`;
  const onClick = leg
    ? (e: React.MouseEvent<HTMLTableCellElement>) =>
        pickLeg({ leg, side, strike }, e.currentTarget)
    : undefined;
  const cells = Children.toArray(children);
  return (
    <>
      {cells.map((child, i) => (
        <td key={i} className={cls} onClick={onClick}>
          {child}
        </td>
      ))}
    </>
  );
}

function OiCell({ oi, chgPct }: { oi?: number; chgPct?: number }) {
  return (
    <div className="oc-oi-cell">
      <div className="oc-oi-main">{fmtCompact(oi)}</div>
      {chgPct !== undefined && (
        <div className="oc-oi-chg">({fmtPct(chgPct)})</div>
      )}
    </div>
  );
}

export default function OptionChainPanel({
  symbol,
  spotLtp,
  spotChangePct,
  onOpenChart,
}: {
  symbol: WatchlistItem;
  spotLtp?: number;
  spotChangePct?: number;
  onOpenChart?: (item: WatchlistItem) => void;
}) {
  const underlying = optionUnderlyingKey(symbol.tradingSymbol, symbol.display);
  const [chain, setChain] = useState<OptionChainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ratePaused, setRatePaused] = useState(false);
  const [expiry, setExpiry] = useState<string>("");
  const [strikeFilter, setStrikeFilter] = useState("");
  const [lastTick, setLastTick] = useState<number | null>(null);
  const prevOiRef = useRef<Map<string, number>>(new Map());
  const chainRef = useRef<OptionChainData | null>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const [activeLeg, setActiveLeg] = useState<LegPick | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [orderSheet, setOrderSheet] = useState<{ item: WatchlistItem; side: "BUY" | "SELL" } | null>(null);
  const [depthSymbol, setDepthSymbol] = useState<WatchlistItem | null>(null);

  useEffect(() => { chainRef.current = chain; }, [chain]);

  const expiryLabel = chain?.expiries.find(e => e.code === expiry)?.label ?? expiry;

  const pickLeg = useCallback((pick: LegPick, el: HTMLElement) => {
    setActiveLeg(pick);
    const wrap = tableWrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setToolbarPos({
      top: r.top - wr.top + wrap.scrollTop + r.height / 2 - 20,
      left: Math.min(wr.width - 200, Math.max(8, r.left - wr.left + r.width / 2 - 100)),
    });
  }, []);

  const legWatchlist = useCallback((pick: LegPick): WatchlistItem | null => {
    if (!chain) return null;
    return optionLegToWatchlist(pick.leg, chain.exchange, chain.underlying, expiryLabel, pick.strike, pick.side);
  }, [chain, expiryLabel]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".oc-strike-toolbar") || t.closest(".oc-leg-cell")) return;
      setActiveLeg(null);
      setToolbarPos(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const loadChain = useCallback(async (expiryCode?: string, silent = false) => {
    if (!underlying) return;
    const hasData = !!chainRef.current?.rows?.length;
    if (!silent || !hasData) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams({
        symbol: symbol.tradingSymbol,
        display: symbol.display,
      });
      const ltp = spotLtp ?? symbol.ltp;
      if (ltp) params.set("ltp", String(ltp));
      if (expiryCode) params.set("expiry", expiryCode);

      const res = await fetch(`/api/v1/market/option-chain?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        const data = json.data as OptionChainData;
        data.spot = ltp ?? data.spot;
        data.spotChangePct = spotChangePct ?? symbol.changePct ?? data.spotChangePct;
        setChain(data);
        setExpiry(data.expiry);
        prevOiRef.current.clear();
        for (const row of data.rows) {
          if (row.ce?.oi) prevOiRef.current.set(row.ce.token, row.ce.oi);
          if (row.pe?.oi) prevOiRef.current.set(row.pe.token, row.pe.oi);
        }
      } else if (!silent || !hasData) {
        setChain(null);
        setError(json.error ?? "Failed to load option chain");
      }
    } catch (e) {
      if (!silent || !hasData) {
        setChain(null);
        setError(e instanceof Error ? e.message : "Network error");
      }
    } finally {
      if (!silent || !hasData) setLoading(false);
    }
  }, [underlying, symbol, spotLtp, spotChangePct, symbol.changePct, symbol.ltp]);

  const refreshQuotes = useCallback(async () => {
    const c = chainRef.current;
    if (!c?.tokens?.length || ratePaused) return;
    if (typeof document !== "undefined" && document.hidden) return;
    setSilentRefreshing(true);
    try {
      const res = await fetch("/api/v1/market/option-chain/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: c.exchange,
          tokens: c.tokens.map(t => t.token),
        }),
        cache: "no-store",
      });
      const json = await res.json();
      if (json.rateLimited) {
        setRatePaused(true);
        setTimeout(() => setRatePaused(false), 30_000);
        return;
      }
      if (!json.ok) return;
      setRatePaused(false);

      setChain(prev => {
        if (!prev) return prev;
        const quotes = json.quotes as Record<string, {
          ltp?: number; netChange?: number; percentChange?: number;
          tradeVolume?: number; opnInterest?: number;
          oiChange?: number; oiChangePct?: number;
        }>;
        const rows = prev.rows.map(row => {
          const patchLeg = (leg?: OptionLeg): OptionLeg | undefined => {
            if (!leg) return leg;
            const q = quotes[leg.token];
            if (!q) return leg;
            const prevOi = prevOiRef.current.get(leg.token);
            const next = { ...leg };
            if (q.ltp != null) next.ltp = q.ltp;
            if (q.netChange != null) next.change = q.netChange;
            if (q.percentChange != null) next.changePct = q.percentChange;
            if (q.tradeVolume != null) next.volume = q.tradeVolume;
            if (q.opnInterest != null) {
              next.oi = q.opnInterest;
              if (q.oiChange != null) {
                next.oiChange = q.oiChange;
                next.oiChangePct = q.oiChangePct;
              } else if (prevOi != null && prevOi > 0) {
                next.oiChange = q.opnInterest - prevOi;
                next.oiChangePct = (next.oiChange / prevOi) * 100;
              }
              prevOiRef.current.set(leg.token, q.opnInterest);
            }
            return next;
          };
          return { ...row, ce: patchLeg(row.ce), pe: patchLeg(row.pe) };
        });
        return { ...prev, rows };
      });
      setLastTick(json.ts ?? Date.now());
    } catch { /* ignore tick errors */ }
    finally { setSilentRefreshing(false); }
  }, [ratePaused]);

  useEffect(() => {
    if (!underlying) return;
    loadChain(undefined, false);
  }, [underlying, symbol.token, loadChain]);

  useEffect(() => {
    if (!chain?.tokens?.length) return;
    const run = () => refreshQuotes();
    const t0 = setTimeout(run, 1_500);
    const id = setInterval(run, SILENT_REFRESH_MS);
    return () => { clearTimeout(t0); clearInterval(id); };
  }, [chain?.expiry, chain?.exchange, chain?.tokens?.length, refreshQuotes]);

  const spot = chain?.spot ?? spotLtp ?? symbol.ltp;
  const spotPct = chain?.spotChangePct ?? spotChangePct ?? symbol.changePct;
  const spotUp = (spotPct ?? 0) >= 0;

  const filteredRows = useMemo(() => {
    if (!chain?.rows) return [];
    const q = strikeFilter.trim();
    if (!q) return chain.rows;
    const n = Number(q);
    if (Number.isFinite(n)) {
      return chain.rows.filter(r => String(r.strike).includes(q));
    }
    return chain.rows;
  }, [chain?.rows, strikeFilter]);

  const maxVol = useMemo(() => {
    let m = 1;
    for (const r of filteredRows) {
      m = Math.max(m, r.ce?.volume ?? 0, r.pe?.volume ?? 0);
    }
    return m;
  }, [filteredRows]);

  const maxOi = useMemo(() => {
    let m = 1;
    for (const r of filteredRows) {
      m = Math.max(m, r.ce?.oi ?? 0, r.pe?.oi ?? 0);
    }
    return m;
  }, [filteredRows]);

  const spotRowIndex = useMemo(() => {
    if (!spot || !filteredRows.length) return -1;
    for (let i = 0; i < filteredRows.length - 1; i++) {
      if (filteredRows[i].strike <= spot && filteredRows[i + 1].strike > spot) return i;
    }
    return -1;
  }, [filteredRows, spot]);

  if (!underlying) {
    return (
      <div className="oc-empty">
        Option chain is available for indices and stocks (NIFTY, BANKNIFTY, RELIANCE, etc.).
      </div>
    );
  }

  if (loading && !chain) {
    return <div className="oc-empty">Loading {underlying} option chain…</div>;
  }

  if (error && !chain) {
    return (
      <div className="oc-empty">
        <p className="oc-error">{error}</p>
        <button type="button" className="oc-btn" onClick={() => loadChain()}>Retry</button>
      </div>
    );
  }

  if (!chain) return null;

  return (
    <div className="oc-root">
      <div className="oc-header">
        <div className="oc-header-left">
          <span className="oc-symbol">{chain.underlying}</span>
          <span className="oc-exchange">[{chain.exchange}]</span>
          {spot !== undefined && (
            <>
              <span className="oc-spot">{Number(spot).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              <span className={spotUp ? "oc-spot-chg up" : "oc-spot-chg down"}>
                {spotUp ? "+" : ""}{(chain.spotChange ?? symbol.change ?? 0).toFixed(2)} ({fmtPct(spotPct)})
              </span>
            </>
          )}
        </div>
        <div className="oc-header-right">
          <select
            className="oc-select"
            value={expiry}
            onChange={e => { setExpiry(e.target.value); loadChain(e.target.value); }}
          >
            {chain.expiries.map(ex => (
              <option key={ex.code} value={ex.code}>{ex.label}</option>
            ))}
          </select>
          <span className="oc-live">
            <span className={`oc-live-dot ${silentRefreshing ? "pulse" : ""}`} />
            {ratePaused ? "Paused (rate limit)" : `Live · ${SILENT_REFRESH_MS / 1000}s`}
            {lastTick ? ` · ${new Date(lastTick).toLocaleTimeString()}` : ""}
          </span>
          <input
            className="oc-search"
            placeholder="Search Strike"
            value={strikeFilter}
            onChange={e => setStrikeFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="oc-table-wrap" ref={tableWrapRef}>
        {activeLeg && toolbarPos && (
          <div
            className="oc-strike-toolbar"
            style={{ top: toolbarPos.top, left: toolbarPos.left }}
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="oc-tb-buy"
              title="Buy F1"
              onClick={() => {
                const w = legWatchlist(activeLeg);
                if (w) setOrderSheet({ item: w, side: "BUY" });
                setActiveLeg(null);
              }}
            >
              B
            </button>
            <button
              type="button"
              className="oc-tb-sell"
              title="Sell"
              onClick={() => {
                const w = legWatchlist(activeLeg);
                if (w) setOrderSheet({ item: w, side: "SELL" });
                setActiveLeg(null);
              }}
            >
              S
            </button>
            <button
              type="button"
              className="oc-tb-icon"
              title="Chart"
              onClick={() => {
                const w = legWatchlist(activeLeg);
                if (w && onOpenChart) onOpenChart(w);
                setActiveLeg(null);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>
            </button>
            <button
              type="button"
              className="oc-tb-icon"
              title="Market depth"
              onClick={() => {
                const w = legWatchlist(activeLeg);
                if (w) setDepthSymbol(w);
                setActiveLeg(null);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="6" width="3" height="12"/><rect x="10" y="9" width="3" height="9"/><rect x="16" y="4" width="3" height="14"/></svg>
            </button>
          </div>
        )}
        <table className="oc-table">
          <thead>
            <tr className="oc-head-calls">
              <th colSpan={4} className="oc-section calls">CALL</th>
              <th className="oc-strike-head">Strike</th>
              <th colSpan={4} className="oc-section puts">PUT</th>
            </tr>
            <tr className="oc-head-cols">
              <th>Volume</th>
              <th>OI Chng. (Chng%)</th>
              <th>OI</th>
              <th>LTP (LTP Chng%)</th>
              <th />
              <th>LTP (LTP Chng%)</th>
              <th>OI</th>
              <th>OI Chng. (Chng%)</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => {
              const ceItm = spot !== undefined && row.strike < spot;
              const peItm = spot !== undefined && row.strike > spot;
              const showSpotLine = idx === spotRowIndex;
              return (
                <Fragment key={row.strike}>
                  {showSpotLine && spot !== undefined && (
                    <tr className="oc-spot-row">
                      <td colSpan={9}>
                        <div className="oc-spot-line">
                          <span>{Number(spot).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr className={`oc-data-row ${activeLeg?.strike === row.strike ? "selected" : ""}`}>
                    <LegCells leg={row.ce} side="CE" strike={row.strike} itm={ceItm} variant="call" pickLeg={pickLeg}>
                      <BarCell value={row.ce?.volume} max={maxVol} />
                      <OiCell oi={row.ce?.oiChange} chgPct={row.ce?.oiChangePct} />
                      <OiCell oi={row.ce?.oi} />
                      <LtpCell ltp={row.ce?.ltp} pct={row.ce?.changePct} />
                    </LegCells>
                    <td
                      className="strike oc-leg-cell"
                      onClick={e => {
                        const leg = row.ce ?? row.pe;
                        if (!leg) return;
                        pickLeg({ leg, side: row.ce ? "CE" : "PE", strike: row.strike }, e.currentTarget);
                      }}
                    >
                      {row.strike.toLocaleString("en-IN")}
                    </td>
                    <LegCells leg={row.pe} side="PE" strike={row.strike} itm={peItm} variant="put" pickLeg={pickLeg}>
                      <LtpCell ltp={row.pe?.ltp} pct={row.pe?.changePct} />
                      <OiCell oi={row.pe?.oi} />
                      <OiCell oi={row.pe?.oiChange} chgPct={row.pe?.oiChangePct} />
                      <BarCell value={row.pe?.volume} max={maxVol} />
                    </LegCells>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="oc-note">
        Click any strike or LTP to trade · chart · market depth. Silent refresh every {SILENT_REFRESH_MS / 1000}s.
      </p>

      {orderSheet && (
        <OptionOrderSheet
          symbol={orderSheet.item}
          initialSide={orderSheet.side}
          onClose={() => setOrderSheet(null)}
          onOpenChart={() => {
            onOpenChart?.(orderSheet.item);
            setOrderSheet(null);
          }}
          onOpenDepth={() => {
            setDepthSymbol(orderSheet.item);
            setOrderSheet(null);
          }}
        />
      )}

      {depthSymbol && (
        <MarketDepthModal
          symbol={depthSymbol}
          onClose={() => setDepthSymbol(null)}
          onOpenChart={() => {
            onOpenChart?.(depthSymbol);
            setDepthSymbol(null);
          }}
        />
      )}
    </div>
  );
}
