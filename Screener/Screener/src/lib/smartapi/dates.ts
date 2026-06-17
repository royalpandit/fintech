/** Format date for SmartAPI: `yyyy-MM-dd HH:mm` in Asia/Kolkata */
export function formatAngelDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function getCandleDateRange(maxDays: number): {
  fromdate: string;
  todate: string;
} {
  const to = new Date();
  const from = new Date(to.getTime() - maxDays * 24 * 60 * 60 * 1000);
  return {
    fromdate: formatAngelDate(from),
    todate: formatAngelDate(to),
  };
}
