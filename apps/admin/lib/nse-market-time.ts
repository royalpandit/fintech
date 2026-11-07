/**
 * NSE market clock — all candle timestamps are IST (Asia/Kolkata) wall time.
 * Unix seconds stored in charts are UTC instants (no double UTC→IST conversion).
 */

export const NSE_TIMEZONE = "Asia/Kolkata";
export const NSE_SESSION_OPEN = { hour: 9, minute: 15 };
export const NSE_SESSION_CLOSE = { hour: 15, minute: 30 };

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const istDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: NSE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export type IstParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getIstParts(ms: number): IstParts {
  const parts = istDateFmt.formatToParts(new Date(ms));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value ?? 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** NSE historical endpoints want from/to as DD-MM-YYYY in IST. */
export function istDateDDMMYYYY(ms = Date.now()): string {
  const p = getIstParts(ms);
  return `${pad2(p.day)}-${pad2(p.month)}-${p.year}`;
}

/** IST wall clock → UTC unix seconds (single conversion). */
export function istWallToUnixSec(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): number {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - IST_OFFSET_MS;
  return Math.floor(utcMs / 1000);
}

/** UTC unix seconds → canonical ISO with +05:30 offset. */
export function unixSecToIsoIst(unixSec: number): string {
  const p = getIstParts(unixSec * 1000);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}+05:30`;
}

/**
 * Parse Angel / API candle timestamp → UTC unix seconds.
 * Naive "YYYY-MM-DD HH:mm:ss" is always interpreted as IST (never server local).
 */
export function parseCandleTimestampToUnix(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;

  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = new Date(s).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
  }

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const ms = new Date(s).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? 0);
  return istWallToUnixSec(year, month, day, hour, minute, second);
}

export function normalizeCandleTimestamp(raw: string): string {
  const sec = parseCandleTimestampToUnix(raw);
  return Number.isFinite(sec) ? unixSecToIsoIst(sec) : raw.trim();
}

/** Angel SmartAPI expects "YYYY-MM-DD HH:mm" in IST. */
export function formatAngelApiDateTime(unixSec: number): string {
  const p = getIstParts(unixSec * 1000);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function angelCandleRange(days: number, nowMs = Date.now()) {
  const nowSec = Math.floor(nowMs / 1000);
  const p = getIstParts(nowMs);
  const todate = `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
  const fromSec = istWallToUnixSec(p.year, p.month, p.day, 9, 15) - days * 86_400;
  const fromdate = formatAngelApiDateTime(fromSec);
  return { fromdate, todate, nowSec };
}

const INTERVAL_MINUTES: Record<string, number> = {
  ONE_MINUTE: 1,
  THREE_MINUTE: 3,
  FIVE_MINUTE: 5,
  TEN_MINUTE: 10,
  FIFTEEN_MINUTE: 15,
  THIRTY_MINUTE: 30,
  ONE_HOUR: 60,
  ONE_DAY: 375, // NSE cash session length (9:15–15:30)
};

/** Start of current NSE session day (09:15 IST) as unix seconds. */
export function nseSessionOpenUnix(nowMs = Date.now()): number {
  const p = getIstParts(nowMs);
  return istWallToUnixSec(p.year, p.month, p.day, NSE_SESSION_OPEN.hour, NSE_SESSION_OPEN.minute);
}

/**
 * Floor current time to the active intraday candle open (NSE session, IST buckets).
 */
export function nseLiveCandleOpenUnix(
  interval: string,
  aggregate = 1,
  nowMs = Date.now(),
): number {
  const barMin = (INTERVAL_MINUTES[interval] ?? 5) * Math.max(1, aggregate);
  if (barMin >= 375) return nseSessionOpenUnix(nowMs);

  const p = getIstParts(nowMs);
  const openMin = NSE_SESSION_OPEN.hour * 60 + NSE_SESSION_OPEN.minute;
  const closeMin = NSE_SESSION_CLOSE.hour * 60 + NSE_SESSION_CLOSE.minute;
  let { year, month, day } = p;
  let curMin = p.hour * 60 + p.minute;

  if (curMin < openMin) {
    const prevMs = nowMs - 86_400_000;
    const pp = getIstParts(prevMs);
    year = pp.year;
    month = pp.month;
    day = pp.day;
    curMin = closeMin;
  } else if (curMin > closeMin) {
    curMin = closeMin;
  }

  const bucketMin = openMin + Math.floor((curMin - openMin) / barMin) * barMin;
  const bh = Math.floor(bucketMin / 60);
  const bm = bucketMin % 60;
  return istWallToUnixSec(year, month, day, bh, bm);
}

/** Anything the chart prints, always read in IST rather than the viewer's zone. */
function istLabel(sec: number, opts: Intl.DateTimeFormatOptions): string {
  return new Date(sec * 1000).toLocaleString("en-IN", { timeZone: NSE_TIMEZONE, ...opts });
}

/**
 * The crosshair's label on the time axis.
 *
 * It used to be the time alone, which on a daily, weekly or monthly chart is
 * the same "00:00" under every bar — the reader could not tell which day they
 * were pointing at. A bar stamped exactly midnight carries no time worth
 * printing (that is how Angel One stamps a daily candle), so it shows its date
 * and nothing else; an intraday bar shows both, because on a one-day view the
 * date appears nowhere else on the chart.
 */
export function nseChartTimeFormatter(time: number): string {
  const sec = Number(time);
  if (!Number.isFinite(sec)) return "";

  const p = getIstParts(sec * 1000);
  if (p.hour === 0 && p.minute === 0) {
    return istLabel(sec, { day: "numeric", month: "short", year: "numeric" });
  }
  return istLabel(sec, {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/**
 * The dates currently on screen, for the chart's own label.
 *
 * The axis can only date a tick that falls on a day boundary, so an intraday
 * chart zoomed inside one session has no date anywhere on it — the common case,
 * since the terminal opens on 5-minute candles. This is what the chart prints
 * in its corner so the day being read is never a guess: one day in view gives
 * the weekday and date, several give the span.
 */
export function nseChartRangeLabel(fromSec: number, toSec: number): string {
  if (!Number.isFinite(fromSec) || !Number.isFinite(toSec)) return "";

  const a = getIstParts(fromSec * 1000);
  const b = getIstParts(toSec * 1000);

  if (a.year === b.year && a.month === b.month && a.day === b.day) {
    // Built in two pieces: en-IN punctuates the one-call version as
    // "Wed, 4 Nov, 2026", with a comma nobody wants in the middle of a date.
    const weekday = istLabel(fromSec, { weekday: "short" });
    const date = istLabel(fromSec, { day: "numeric", month: "short", year: "numeric" });
    return `${weekday}, ${date}`;
  }

  // The year is carried by the right-hand date unless the span crosses one.
  const left = istLabel(fromSec, a.year === b.year
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" });
  const right = istLabel(toSec, { day: "numeric", month: "short", year: "numeric" });
  return `${left} – ${right}`;
}

/*
 * lightweight-charts' TickMarkType, written out rather than imported.
 *
 * This module is shared with server code that must not pull in a charting
 * library, and the enum is four stable numbers: Year, Month, DayOfMonth, Time,
 * TimeWithSeconds.
 */
const TICK_YEAR = 0;
const TICK_MONTH = 1;
const TICK_DAY_OF_MONTH = 2;
const TICK_TIME = 3;
const TICK_TIME_WITH_SECONDS = 4;

/**
 * One label on the time axis.
 *
 * The chart tells us which boundary each tick is — a year, a month, a day, or a
 * time within a day — and the label follows that, which is how a date gets onto
 * the axis at all. The previous version ignored it and printed a date only for
 * a bar stamped exactly 09:15, the NSE open. That left two charts with no date
 * anywhere on them: a daily chart from Angel One, whose bars are stamped
 * midnight, labelled every tick "00:00"; and any intraday chart zoomed into a
 * single session, where no 09:15 bar is in view and every tick is a time.
 */
export function nseChartTickMarkFormatter(time: number, tickMarkType?: number): string {
  const sec = Number(time);
  if (!Number.isFinite(sec)) return "";

  switch (tickMarkType) {
    case TICK_YEAR:
      return istLabel(sec, { year: "numeric" });
    case TICK_MONTH:
      return istLabel(sec, { month: "short" });
    case TICK_DAY_OF_MONTH:
      return istLabel(sec, { day: "numeric", month: "short" });
    case TICK_TIME:
      return istLabel(sec, { hour: "2-digit", minute: "2-digit", hour12: false });
    case TICK_TIME_WITH_SECONDS:
      return istLabel(sec, {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      });
  }

  // Called without a type: date for a midnight-stamped bar, time otherwise.
  const p = getIstParts(sec * 1000);
  return p.hour === 0 && p.minute === 0
    ? istLabel(sec, { day: "numeric", month: "short" })
    : istLabel(sec, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export const nseChartLocalization = {
  locale: "en-IN",
  timeFormatter: nseChartTimeFormatter,
  dateFormat: "dd MMM 'yy",
} as const;

/**
 * Is the NSE cash session open right now?
 *
 * Weekday + 09:15–15:30 IST. Trading holidays are not modelled, so this can
 * return true on a holiday — acceptable for gating background work (a quote
 * fetch simply returns stale data), but don't rely on it for anything that
 * must be exact.
 */
export function isMarketOpenNow(nowMs = Date.now()): boolean {
  const { year, month, day, hour, minute } = getIstParts(nowMs);

  // Day-of-week from the IST calendar date, avoiding local-timezone drift.
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (dow === 0 || dow === 6) return false;

  const mins = hour * 60 + minute;
  const open = NSE_SESSION_OPEN.hour * 60 + NSE_SESSION_OPEN.minute;
  const close = NSE_SESSION_CLOSE.hour * 60 + NSE_SESSION_CLOSE.minute;
  return mins >= open && mins <= close;
}
