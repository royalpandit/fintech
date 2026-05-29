/** Fixed locale so SSR and client hydration produce identical date strings. */
const LOCALE = "en-IN";

const DEFAULT_DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

export function formatLocaleDate(
  value: Date | string,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTS
): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE, options);
}

/** Relative label for feeds; falls back to {@link formatLocaleDate} for older items. */
export function formatRelativeTime(date: string): string {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return "—";

  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatLocaleDate(date);
}
