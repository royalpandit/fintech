// Pure, client-safe helpers for subscription services (no prisma import, so they
// can be used from "use client" components without pulling `pg` into the bundle).

export const SERVICE_CATEGORIES = [
  "stocks",
  "futures",
  "options",
  "commodity",
  "currency",
  "crypto",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export function categoryLabel(c: string | null | undefined): string {
  if (!c) return "—";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** Yearly savings vs. 12× monthly, as a whole percentage (0 if none). */
export function yearlySavingsPct(monthly: number, yearly: number | null): number {
  if (!yearly || monthly <= 0) return 0;
  const full = monthly * 12;
  if (yearly >= full) return 0;
  return Math.round(((full - yearly) / full) * 100);
}

export function isServiceCategory(v: unknown): v is ServiceCategory {
  return typeof v === "string" && (SERVICE_CATEGORIES as readonly string[]).includes(v);
}
