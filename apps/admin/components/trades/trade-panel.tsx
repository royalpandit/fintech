// Compact trade summary shown on feed cards and the trade detail view.
// Trades Phase 1/2 — see TRADES-PHASE1-2-CHANGES.md.

import {
  tradeSide,
  tradeStatusMeta,
  timeframeLabel,
  potentialReturnPct,
  riskRewardRatio,
  formatRiskReward,
  formatPct,
  formatPrice,
  formatEntryRange,
} from "@/lib/trades";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export type TradePanelData = {
  sentiment?: string | null;
  exchange?: string | null;
  marketSymbol?: string | null;
  tradeStatus?: string | null;
  timeframeType?: string | null;
  riskLevel?: string | null;
  conviction?: number | null;
  entryPriceMin?: number | string | null;
  entryPriceMax?: number | string | null;
  targetPrice?: number | string | null;
  stopLossPrice?: number | string | null;
};

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="trade-cell">
      <span className="trade-cell-label">{label}</span>
      <span className="trade-cell-value">{value}</span>
    </div>
  );
}

export default function TradePanel({
  data,
  showStars = true,
  // Locked teaser mode: entry/SL/target are hidden, only side/status/upside show.
  locked = false,
  hasTrade,
  precomputedReturnPct,
  unlockPrice,
  onUnlock,
}: {
  data: TradePanelData;
  showStars?: boolean;
  locked?: boolean;
  hasTrade?: boolean;
  precomputedReturnPct?: number | null;
  unlockPrice?: number | null;
  onUnlock?: () => void;
}) {
  const entryMin = num(data.entryPriceMin);
  const entryMax = num(data.entryPriceMax);
  const target = num(data.targetPrice);
  const sl = num(data.stopLossPrice);

  const side = tradeSide(data.sentiment);
  const status = tradeStatusMeta(data.tradeStatus);
  const horizon = timeframeLabel(data.timeframeType);

  // ── Locked teaser ────────────────────────────────────────────────────────
  if (locked) {
    if (!hasTrade) return null;
    const ret = precomputedReturnPct ?? null;
    return (
      <div className="trade-panel trade-panel-locked">
        <div className="trade-panel-head">
          {side && <span className={`trade-side trade-side-${side.toLowerCase()}`}>{side}</span>}
          {(data.exchange || data.marketSymbol) && (
            <span className="trade-symbol">
              {data.exchange ? `${data.exchange}: ` : ""}
              {data.marketSymbol}
            </span>
          )}
          <span className="trade-status" style={{ color: status.tone, background: `${status.tone}1f` }}>
            {status.label}
          </span>
        </div>

        <div className="trade-locked-body">
          <div className="trade-locked-blur" aria-hidden>
            <div className="trade-grid">
              <Cell label="Entry" value="₹ ••••" />
              <Cell label="Stop Loss" value="₹ ••••" />
              <Cell label="Target" value="₹ ••••" />
              <Cell label="Potential" value="••••" />
            </div>
          </div>
          <div className="trade-locked-overlay">
            <span className="trade-locked-lock">🔒</span>
            <span className="trade-locked-msg">Premium trade — unlock to view details</span>
          </div>
        </div>

        <div className="trade-locked-foot">
          <div className="trade-locked-upside">
            <span className="trade-cell-label">Potential Upside</span>
            <span
              className="trade-cell-value"
              style={{ color: ret == null ? "var(--text)" : ret >= 0 ? "#16a34a" : "#dc2626", fontSize: 16 }}
            >
              {formatPct(ret)}
            </span>
          </div>
          {onUnlock && (
            <button type="button" className="trade-unlock-btn" onClick={onUnlock}>
              🔓 Unlock{unlockPrice ? ` ₹${unlockPrice}` : ""}
            </button>
          )}
        </div>
      </div>
    );
  }
  // ── Full (unlocked) ──────────────────────────────────────────────────────

  // Nothing trade-like to show → render nothing (keeps plain analysis posts clean).
  if (entryMin == null && entryMax == null && target == null && sl == null) {
    return null;
  }

  const ret = potentialReturnPct({ entryMin, entryMax, target, side });
  const rr = riskRewardRatio({ entryMin, entryMax, target, stopLoss: sl });

  return (
    <div className="trade-panel">
      <div className="trade-panel-head">
        {side && (
          <span className={`trade-side trade-side-${side.toLowerCase()}`}>{side}</span>
        )}
        {(data.exchange || data.marketSymbol) && (
          <span className="trade-symbol">
            {data.exchange ? `${data.exchange}: ` : ""}
            {data.marketSymbol}
          </span>
        )}
        <span
          className="trade-status"
          style={{ color: status.tone, background: `${status.tone}1f` }}
        >
          {status.label}
        </span>
      </div>

      <div className="trade-grid">
        <Cell label="Entry" value={formatEntryRange(entryMin, entryMax)} />
        <Cell label="Stop Loss" value={formatPrice(sl)} />
        <Cell label="Target" value={formatPrice(target)} />
        <div className="trade-cell trade-cell-return">
          <span className="trade-cell-label">Potential Return</span>
          <span
            className="trade-cell-value"
            style={{ color: ret == null ? "var(--text)" : ret >= 0 ? "#16a34a" : "#dc2626" }}
          >
            {formatPct(ret)}
          </span>
        </div>
      </div>

      {(horizon || data.riskLevel || rr != null || (showStars && data.conviction)) && (
        <div className="trade-meta">
          {horizon && <span className="trade-chip trade-chip-time">{horizon}</span>}
          {data.riskLevel && (
            <span className={`trade-chip trade-chip-risk-${data.riskLevel}`}>
              {data.riskLevel} Risk
            </span>
          )}
          {rr != null && (
            <span className="trade-chip" title="Risk : Reward">
              RR {formatRiskReward(rr)}
            </span>
          )}
          {showStars && data.conviction ? (
            <span className="trade-stars" title={`Conviction ${data.conviction}/5`}>
              {"★".repeat(data.conviction)}
              <span className="trade-stars-empty">{"★".repeat(5 - data.conviction)}</span>
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
