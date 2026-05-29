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

/** lightweight-charts axis — always label in IST. */
export function nseChartTimeFormatter(time: number): string {
  return new Date(time * 1000).toLocaleTimeString("en-IN", {
    timeZone: NSE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function nseChartTickMarkFormatter(time: number): string {
  const sec = typeof time === "number" ? time : Number(time);
  const d = new Date(sec * 1000);
  const p = getIstParts(sec * 1000);
  const isSessionDay = p.hour === NSE_SESSION_OPEN.hour && p.minute === NSE_SESSION_OPEN.minute;

  if (isSessionDay && p.second === 0) {
    return d.toLocaleDateString("en-IN", {
      timeZone: NSE_TIMEZONE,
      day: "numeric",
      month: "short",
    });
  }

  return d.toLocaleTimeString("en-IN", {
    timeZone: NSE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export const nseChartLocalization = {
  locale: "en-IN",
  timeFormatter: nseChartTimeFormatter,
  dateFormat: "dd MMM 'yy",
} as const;
