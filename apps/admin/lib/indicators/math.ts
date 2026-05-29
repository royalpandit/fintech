export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period < 1) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period < 1 || values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function stddev(values: number[], period: number): number[] {
  const mean = sma(values, period);
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    const m = mean[i];
    if (!Number.isFinite(m)) continue;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) acc += (values[j] - m) ** 2;
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length <= period) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function atr(high: number[], low: number[], close: number[], period: number): number[] {
  const tr = new Array<number>(close.length).fill(NaN);
  for (let i = 0; i < close.length; i++) {
    if (i === 0) tr[i] = high[i] - low[i];
    else {
      tr[i] = Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1]),
      );
    }
  }
  return ema(tr.map(v => (Number.isFinite(v) ? v : 0)), period);
}

export function toSeries(
  times: number[],
  values: number[],
): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  for (let i = 0; i < times.length; i++) {
    const v = values[i];
    if (Number.isFinite(v)) out.push({ time: times[i], value: v });
  }
  return out;
}
