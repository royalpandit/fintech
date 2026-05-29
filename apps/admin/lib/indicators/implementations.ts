import type { IndicatorContext, IndicatorComputeResult, IndicatorSeriesOutput } from "./types";
import { atr, ema, rsi, sma, stddev, toSeries } from "./math";

const VOL_UP = "rgba(38, 166, 154, 0.55)";
const VOL_DOWN = "rgba(239, 83, 80, 0.55)";

function line(
  key: string,
  title: string,
  pane: IndicatorSeriesOutput["pane"],
  color: string,
  times: number[],
  values: number[],
  lineWidth = 2,
): IndicatorSeriesOutput {
  return {
    key,
    title,
    pane,
    type: "line",
    color,
    lineWidth,
    data: toSeries(times, values),
  };
}

export function computeVolume(ctx: IndicatorContext): IndicatorComputeResult {
  const data = ctx.candles.map((c, i) => {
    const v = Math.max(0, ctx.volume[i] ?? 0);
    const maxVol = Math.max(0, ...ctx.volume);
    let value = v;
    if (maxVol <= 0) {
      const maxRange = Math.max(1e-6, ...ctx.candles.map(x => x.high - x.low));
      value = Math.max(1, Math.round(((c.high - c.low) / maxRange) * 1000));
    }
    return {
      time: ctx.times[i],
      value,
      color: c.close >= c.open ? VOL_UP : VOL_DOWN,
    };
  });
  return {
    series: [{
      key: "volume",
      title: "Volume",
      pane: "volume",
      type: "histogram",
      color: "#64748b",
      data,
    }],
  };
}

export function computeSma(ctx: IndicatorContext, period: number, id: string, color: string): IndicatorComputeResult {
  return {
    series: [line(id, `MA ${period}`, "overlay", color, ctx.times, sma(ctx.close, period))],
  };
}

export function computeEma(ctx: IndicatorContext, period: number, id: string, color: string): IndicatorComputeResult {
  return {
    series: [line(id, `EMA ${period}`, "overlay", color, ctx.times, ema(ctx.close, period))],
  };
}

export function computeVwap(ctx: IndicatorContext): IndicatorComputeResult {
  const out = new Array<number>(ctx.close.length).fill(NaN);
  let cumTpV = 0;
  let cumV = 0;
  for (let i = 0; i < ctx.close.length; i++) {
    const tp = (ctx.high[i] + ctx.low[i] + ctx.close[i]) / 3;
    const v = Math.max(0, ctx.volume[i] ?? 0);
    cumTpV += tp * v;
    cumV += v;
    out[i] = cumV > 0 ? cumTpV / cumV : tp;
  }
  return { series: [line("vwap", "VWAP", "overlay", "#8b5cf6", ctx.times, out)] };
}

export function computeRsi(ctx: IndicatorContext, period = 14): IndicatorComputeResult {
  return {
    series: [line("rsi", `RSI (${period})`, "rsi", "#ec4899", ctx.times, rsi(ctx.close, period), 2)],
  };
}

export function computeMacd(
  ctx: IndicatorContext,
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): IndicatorComputeResult {
  const emaFast = ema(ctx.close, fast);
  const emaSlow = ema(ctx.close, slow);
  const macdLine = emaFast.map((f, i) => {
    const s = emaSlow[i];
    return Number.isFinite(f) && Number.isFinite(s) ? f - s : NaN;
  });
  const signal = ema(
    macdLine.map(v => (Number.isFinite(v) ? v : 0)),
    signalPeriod,
  );
  const hist = macdLine.map((m, i) => {
    const s = signal[i];
    return Number.isFinite(m) && Number.isFinite(s) ? m - s : NaN;
  });

  const histData = ctx.times.map((time, i) => {
    const v = hist[i];
    if (!Number.isFinite(v)) return null;
    return {
      time,
      value: v,
      color: v >= 0 ? "rgba(38, 166, 154, 0.65)" : "rgba(239, 83, 80, 0.65)",
    };
  }).filter((p): p is { time: number; value: number; color: string } => p != null);

  return {
    series: [
      line("macd-line", "MACD", "macd", "#14b8a6", ctx.times, macdLine, 2),
      line("macd-signal", "Signal", "macd", "#f59e0b", ctx.times, signal, 1),
      {
        key: "macd-hist",
        title: "Histogram",
        pane: "macd",
        type: "histogram",
        color: "#64748b",
        data: histData,
      },
    ],
  };
}

export function computeBollinger(
  ctx: IndicatorContext,
  period = 20,
  mult = 2,
): IndicatorComputeResult {
  const mid = sma(ctx.close, period);
  const dev = stddev(ctx.close, period);
  const upper = mid.map((m, i) => (Number.isFinite(m) && Number.isFinite(dev[i]) ? m + mult * dev[i] : NaN));
  const lower = mid.map((m, i) => (Number.isFinite(m) && Number.isFinite(dev[i]) ? m - mult * dev[i] : NaN));
  return {
    series: [
      line("bb-upper", "BB Upper", "overlay", "#6366f1", ctx.times, upper, 1),
      line("bb-mid", "BB Middle", "overlay", "#6366f1", ctx.times, mid, 1),
      line("bb-lower", "BB Lower", "overlay", "#6366f1", ctx.times, lower, 1),
    ],
  };
}

/** TradingView-style Supertrend (ATR period, multiplier). */
export function computeSupertrend(
  ctx: IndicatorContext,
  period = 10,
  multiplier = 3,
): IndicatorComputeResult {
  const len = ctx.close.length;
  const atrArr = atr(ctx.high, ctx.low, ctx.close, period);
  const st = new Array<number>(len).fill(NaN);
  const finalUpper = new Array<number>(len).fill(NaN);
  const finalLower = new Array<number>(len).fill(NaN);
  let trend = 1;

  for (let i = 0; i < len; i++) {
    const hl2 = (ctx.high[i] + ctx.low[i]) / 2;
    const a = atrArr[i];
    if (!Number.isFinite(a)) continue;

    const basicUpper = hl2 + multiplier * a;
    const basicLower = hl2 - multiplier * a;

    if (i === 0) {
      finalUpper[i] = basicUpper;
      finalLower[i] = basicLower;
      st[i] = basicLower;
      continue;
    }

    finalUpper[i] =
      basicUpper < finalUpper[i - 1] || ctx.close[i - 1] > finalUpper[i - 1]
        ? basicUpper
        : finalUpper[i - 1];
    finalLower[i] =
      basicLower > finalLower[i - 1] || ctx.close[i - 1] < finalLower[i - 1]
        ? basicLower
        : finalLower[i - 1];

    if (trend === 1) {
      if (ctx.close[i] < finalLower[i]) trend = -1;
    } else if (ctx.close[i] > finalUpper[i]) {
      trend = 1;
    }

    st[i] = trend === 1 ? finalLower[i] : finalUpper[i];
  }

  return {
    series: [line("supertrend", "Supertrend", "overlay", "#22c55e", ctx.times, st, 2)],
  };
}
