"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OptionChainData } from "./option-chain-panel";
import {
  expiryDisplayLabel,
  formatOiChangePct,
  formatOiIndian,
  maxOiValues,
  rowsToOiProfile,
  type OiStrikeProfile,
} from "@/lib/oi-profile";

const PROFILE_WIDTH = 88;
const BAR_MAX = 72;

type SeriesApi = {
  priceToCoordinate?: (price: number) => number | null;
};

type ChartApi = {
  timeScale: () => {
    subscribeVisibleLogicalRangeChange?: (fn: () => void) => void;
    unsubscribeVisibleLogicalRangeChange?: (fn: () => void) => void;
  };
};

type Props = {
  chain: OptionChainData | null;
  symbolLabel: string;
  chartRef: RefObject<ChartApi | null>;
  seriesRef: RefObject<SeriesApi | null>;
  paneRef: RefObject<HTMLDivElement | null>;
  /** Bumps on live tick / chain refresh — re-sync bar positions. */
  refreshKey?: number;
};

type PlacedStrike = {
  profile: OiStrikeProfile;
  y: number;
  rowH: number;
};

export default function OiProfileOverlay({
  chain,
  symbolLabel,
  chartRef,
  seriesRef,
  paneRef,
  refreshKey = 0,
}: Props) {
  const [placed, setPlaced] = useState<PlacedStrike[]>([]);
  const [hover, setHover] = useState<{
    profile: OiStrikeProfile;
    x: number;
    y: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const profiles = useMemo(
    () => (chain?.rows ? rowsToOiProfile(chain.rows) : []),
    [chain?.rows, refreshKey],
  );

  const scales = useMemo(() => maxOiValues(profiles), [profiles]);

  const layoutStrikes = useCallback(() => {
    const pane = paneRef.current;
    const series = seriesRef.current;
    if (!pane || !series?.priceToCoordinate || profiles.length === 0) {
      setPlaced([]);
      return;
    }

    const paneH = pane.clientHeight;
    const priceToY = (strike: number) => {
      const y = series.priceToCoordinate!(strike);
      return y != null ? y : null;
    };

    const visible: { profile: OiStrikeProfile; y: number }[] = [];
    for (const profile of profiles) {
      const y = priceToY(profile.strike);
      if (y == null || y < -24 || y > paneH + 24) continue;
      visible.push({ profile, y });
    }

    visible.sort((a, b) => a.y - b.y);

    const out: PlacedStrike[] = [];
    for (let i = 0; i < visible.length; i++) {
      const cur = visible[i];
      const nextY = visible[i + 1]?.y;
      const prevY = visible[i - 1]?.y;
      const gapBelow = nextY != null ? nextY - cur.y : 24;
      const gapAbove = prevY != null ? cur.y - prevY : 24;
      const rowH = Math.min(22, Math.max(10, Math.min(gapBelow, gapAbove) * 0.85));
      out.push({ profile: cur.profile, y: cur.y, rowH });
    }
    setPlaced(out);
  }, [paneRef, seriesRef, profiles]);

  useEffect(() => {
    layoutStrikes();
    const pane = paneRef.current;
    const chart = chartRef.current;
    if (!pane) return;

    const ro = new ResizeObserver(() => layoutStrikes());
    ro.observe(pane);

    let rangeHandler: (() => void) | undefined;
    try {
      rangeHandler = () => layoutStrikes();
      chart?.timeScale().subscribeVisibleLogicalRangeChange?.(rangeHandler);
    } catch { /* ignore */ }

    return () => {
      ro.disconnect();
      if (rangeHandler) {
        try {
          chart?.timeScale().unsubscribeVisibleLogicalRangeChange?.(rangeHandler);
        } catch { /* ignore */ }
      }
    };
  }, [layoutStrikes, paneRef, chartRef, refreshKey]);

  const onOverlayMove = (e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || placed.length === 0) {
      setHover(null);
      return;
    }
    const localY = e.clientY - rect.top;
    let best: PlacedStrike | null = null;
    let bestDist = Infinity;
    for (const row of placed) {
      const d = Math.abs(localY - row.y);
      if (d < row.rowH && d < bestDist) {
        bestDist = d;
        best = row;
      }
    }
    if (best) {
      setHover({ profile: best.profile, x: e.clientX, y: e.clientY });
    } else {
      setHover(null);
    }
  };

  if (!chain || profiles.length === 0) return null;

  const expiryLabel = expiryDisplayLabel(chain.expiry);

  return (
    <>
      <div
        ref={overlayRef}
        className="oi-prof-overlay"
        style={{ width: PROFILE_WIDTH }}
        onMouseMove={onOverlayMove}
        onMouseLeave={() => setHover(null)}
        role="presentation"
      >
        {placed.map(({ profile, y, rowH }) => {
          const callW = Math.max(2, (profile.callOi / scales.maxAny) * BAR_MAX);
          const putW = Math.max(2, (profile.putOi / scales.maxAny) * BAR_MAX);
          const isHot = hover?.profile.strike === profile.strike;
          return (
            <div
              key={profile.strike}
              className={`oi-prof-row${isHot ? " hot" : ""}`}
              style={{
                top: y - rowH / 2,
                height: rowH,
              }}
            >
              <div
                className="oi-prof-bar call"
                style={{ width: callW }}
                title={`Call OI ${formatOiIndian(profile.callOi)}`}
              />
              <div
                className="oi-prof-bar put"
                style={{ width: putW }}
                title={`Put OI ${formatOiIndian(profile.putOi)}`}
              />
            </div>
          );
        })}
      </div>

      {hover && (
        <div
          className="oi-prof-tooltip"
          style={{
            left: Math.min(hover.x + 14, typeof window !== "undefined" ? window.innerWidth - 280 : hover.x + 14),
            top: hover.y + 12,
          }}
          role="tooltip"
        >
          <div className="oi-prof-tip-head">
            <span className="oi-prof-tip-title">
              {symbolLabel} {hover.profile.strike.toLocaleString("en-IN")}
            </span>
            <span className="oi-prof-tip-exp">{expiryLabel}</span>
          </div>
          <div className="oi-prof-tip-grid">
            <div className="oi-prof-tip-col">
              <span className="oi-prof-tip-label call">Call OI</span>
              <span className="oi-prof-tip-val">
                {formatOiIndian(hover.profile.callOi)}
                {hover.profile.callOiChangePct != null && (
                  <em className={hover.profile.callOiChangePct >= 0 ? "up" : "down"}>
                    {" "}({formatOiChangePct(hover.profile.callOiChangePct)})
                  </em>
                )}
              </span>
            </div>
            <div className="oi-prof-tip-col">
              <span className="oi-prof-tip-label put">Put OI</span>
              <span className="oi-prof-tip-val">
                {formatOiIndian(hover.profile.putOi)}
                {hover.profile.putOiChangePct != null && (
                  <em className={hover.profile.putOiChangePct >= 0 ? "up" : "down"}>
                    {" "}({formatOiChangePct(hover.profile.putOiChangePct)})
                  </em>
                )}
              </span>
            </div>
          </div>
          {hover.profile.pcr != null && (
            <div className="oi-prof-tip-pcr">
              PCR <b>{hover.profile.pcr.toFixed(2)}</b>
            </div>
          )}
        </div>
      )}
    </>
  );
}
