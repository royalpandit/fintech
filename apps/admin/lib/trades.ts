// Shared helpers for advisor "trades" (market posts with a lifecycle).
// Added by Trades Phase 1/2 — see TRADES-PHASE1-2-CHANGES.md.

export type TradeStatus =
  | "draft"
  | "awaiting_entry"
  | "active"
  | "target_hit"
  | "sl_hit"
  | "exited"
  | "closed"
  | "cancelled";

export type TradeTimeframe = "intraday" | "short_term" | "medium_term" | "long_term";

export type TradeUpdateKind =
  | "published"
  | "entry_triggered"
  | "sl_moved"
  | "target_hit"
  | "sl_hit"
  | "closed"
  | "note"
  | "partial_booked"
  | "exited"
  | "cancelled";

export type TradeEntryType = "market" | "exact" | "range";

// GST applied to paid-trade unlock prices (India, 18%).
export const GST_RATE = 0.18;
export function withGst(price: number): number {
  return Math.round(price * (1 + GST_RATE));
}

export const TRADE_STATUSES: { value: TradeStatus; label: string; tone: string }[] = [
  { value: "draft", label: "Draft", tone: "#94a3b8" },
  { value: "awaiting_entry", label: "Awaiting Entry", tone: "#f59e0b" },
  { value: "active", label: "Active", tone: "#10b981" },
  { value: "target_hit", label: "Target Hit", tone: "#16a34a" },
  { value: "sl_hit", label: "Stop Loss Hit", tone: "#dc2626" },
  { value: "exited", label: "Exited", tone: "#0ea5e9" },
  { value: "closed", label: "Closed", tone: "#64748b" },
  { value: "cancelled", label: "Cancelled", tone: "#64748b" },
];

export const TRADE_TIMEFRAMES: { value: TradeTimeframe; label: string }[] = [
  { value: "intraday", label: "Intraday" },
  { value: "short_term", label: "Short Term" },
  { value: "medium_term", label: "Medium Term" },
  { value: "long_term", label: "Long Term" },
];

export const TRADE_UPDATE_KINDS: { value: TradeUpdateKind; label: string }[] = [
  { value: "entry_triggered", label: "Entry Triggered" },
  { value: "sl_moved", label: "Move Stop Loss to Cost" },
  { value: "partial_booked", label: "Book Partial Profit" },
  { value: "target_hit", label: "Target Hit" },
  { value: "sl_hit", label: "Stop Loss Hit" },
  { value: "note", label: "Update" },
];

/** Status a trade should move to when an update of this kind is logged. */
export const STATUS_FOR_UPDATE_KIND: Partial<Record<TradeUpdateKind, TradeStatus>> = {
  entry_triggered: "active",
  target_hit: "target_hit",
  sl_hit: "sl_hit",
  exited: "exited",
  cancelled: "cancelled",
  closed: "closed",
};

/** Trades that are finished — no further updates expected. */
export function isTradeClosedStatus(s: string | null | undefined): boolean {
  return s === "target_hit" || s === "sl_hit" || s === "exited" || s === "closed" || s === "cancelled";
}

export function tradeStatusMeta(value: string | null | undefined) {
  return (
    TRADE_STATUSES.find((s) => s.value === value) ?? TRADE_STATUSES[0]
  );
}

export function timeframeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return TRADE_TIMEFRAMES.find((t) => t.value === value)?.label ?? null;
}

export function isTradeStatus(v: unknown): v is TradeStatus {
  return typeof v === "string" && TRADE_STATUSES.some((s) => s.value === v);
}

export function isTradeTimeframe(v: unknown): v is TradeTimeframe {
  return typeof v === "string" && TRADE_TIMEFRAMES.some((t) => t.value === v);
}

export function isTradeUpdateKind(v: unknown): v is TradeUpdateKind {
  return (
    typeof v === "string" &&
    (TRADE_UPDATE_KINDS.some((k) => k.value === v) || v === "published")
  );
}

/** BUY/SELL derived from sentiment — bearish reads as a SELL call. */
export function tradeSide(sentiment: string | null | undefined): "BUY" | "SELL" | null {
  if (sentiment === "bullish") return "BUY";
  if (sentiment === "bearish") return "SELL";
  return null;
}

/** Mid-point of the entry range, falling back to whichever bound exists. */
export function entryMid(min?: number | null, max?: number | null): number | null {
  if (min != null && max != null) return (min + max) / 2;
  return min ?? max ?? null;
}

/**
 * Potential return from entry to target, as a signed percentage.
 * For a SELL call the profit direction is inverted.
 * Returns null when there isn't enough data (no live price needed).
 */
export function potentialReturnPct(args: {
  entryMin?: number | null;
  entryMax?: number | null;
  target?: number | null;
  side?: "BUY" | "SELL" | null;
}): number | null {
  const entry = entryMid(args.entryMin, args.entryMax);
  if (entry == null || !args.target || entry === 0) return null;
  const raw = ((args.target - entry) / entry) * 100;
  return args.side === "SELL" ? -raw : raw;
}

export function formatPct(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** "₹1,510 – ₹1,520", or a single price when only one bound is set. */
export function formatEntryRange(
  min?: number | null,
  max?: number | null,
): string {
  if (min != null && max != null && min !== max) {
    return `${formatPrice(min)} – ${formatPrice(max)}`;
  }
  const one = min ?? max;
  return one != null ? formatPrice(one) : "—";
}

// ── Auto calculations (no live price needed) ────────────────────────────────

/** Downside % from entry to stop-loss (always shown as a magnitude, signed −). */
export function potentialLossPct(args: {
  entryMin?: number | null;
  entryMax?: number | null;
  stopLoss?: number | null;
  side?: "BUY" | "SELL" | null;
}): number | null {
  const entry = entryMid(args.entryMin, args.entryMax);
  if (entry == null || !args.stopLoss || entry === 0) return null;
  const raw = ((args.stopLoss - entry) / entry) * 100;
  const signed = args.side === "SELL" ? -raw : raw;
  return -Math.abs(signed); // loss is always negative
}

/** Reward:risk ratio, e.g. 2.8 → "1 : 2.8". Null if not computable. */
export function riskRewardRatio(args: {
  entryMin?: number | null;
  entryMax?: number | null;
  target?: number | null;
  stopLoss?: number | null;
}): number | null {
  const entry = entryMid(args.entryMin, args.entryMax);
  if (entry == null || !args.target || !args.stopLoss) return null;
  const reward = Math.abs(args.target - entry);
  const risk = Math.abs(entry - args.stopLoss);
  if (risk === 0) return null;
  return reward / risk;
}

export function formatRiskReward(rr: number | null): string {
  return rr == null ? "—" : `1 : ${rr.toFixed(1)}`;
}

/** Whole days since a trade was published. */
export function daysActive(publishedAt: string | Date | null | undefined): number | null {
  if (!publishedAt) return null;
  const start = new Date(publishedAt).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
}

/** Realised return from entry to an exit price (used when an analyst exits). */
export function exitReturnPct(args: {
  entryMin?: number | null;
  entryMax?: number | null;
  exit?: number | null;
  side?: "BUY" | "SELL" | null;
}): number | null {
  const entry = entryMid(args.entryMin, args.entryMax);
  if (entry == null || args.exit == null || entry === 0) return null;
  const raw = ((args.exit - entry) / entry) * 100;
  return args.side === "SELL" ? -raw : raw;
}

// ── Analyst performance (aggregated from closed trades) ─────────────────────

export type TradePerfInput = {
  tradeStatus: string;
  exitReturnPct?: number | null;
  entryPriceMin?: number | null;
  entryPriceMax?: number | null;
  targetPrice?: number | null;
  stopLossPrice?: number | null;
  sentiment?: string | null;
};

export type AnalystPerformance = {
  total: number;
  open: number;
  winning: number;
  losing: number;
  cancelled: number;
  winRatePct: number | null;
  avgReturnPct: number | null;
};

/** Realised return for a finished trade — exit % if set, else the modelled
 *  target/SL move. Winners = target_hit, losers = sl_hit. */
function realisedReturn(t: TradePerfInput): number | null {
  if (t.exitReturnPct != null) return Number(t.exitReturnPct);
  const side = tradeSide(t.sentiment);
  if (t.tradeStatus === "target_hit") {
    return potentialReturnPct({
      entryMin: t.entryPriceMin,
      entryMax: t.entryPriceMax,
      target: t.targetPrice,
      side,
    });
  }
  if (t.tradeStatus === "sl_hit") {
    return potentialLossPct({
      entryMin: t.entryPriceMin,
      entryMax: t.entryPriceMax,
      stopLoss: t.stopLossPrice,
      side,
    });
  }
  return null;
}

export function computeAnalystPerformance(trades: TradePerfInput[]): AnalystPerformance {
  // Cancelled + drafts don't count toward accuracy.
  const counted = trades.filter((t) => t.tradeStatus !== "draft");
  const cancelled = counted.filter((t) => t.tradeStatus === "cancelled").length;
  const open = counted.filter(
    (t) => t.tradeStatus === "awaiting_entry" || t.tradeStatus === "active",
  ).length;
  const finished = counted.filter((t) => isTradeClosedStatus(t.tradeStatus) && t.tradeStatus !== "cancelled");

  let winning = 0;
  let losing = 0;
  const returns: number[] = [];
  for (const t of finished) {
    const r = realisedReturn(t);
    if (r != null) returns.push(r);
    if (r != null ? r >= 0 : t.tradeStatus === "target_hit") winning++;
    else losing++;
  }

  const decided = winning + losing;
  return {
    total: counted.length,
    open,
    winning,
    losing,
    cancelled,
    winRatePct: decided > 0 ? (winning / decided) * 100 : null,
    avgReturnPct: returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : null,
  };
}
