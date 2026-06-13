// Boost plans (pricing shown in the UI). No payment is processed — selecting a
// plan simply boosts the post for the given duration.

export type BoostTierId = "24h" | "7d" | "30d";

export type BoostTier = {
  id: BoostTierId;
  label: string;
  days: number;
  price: number; // INR, display-only for now
  blurb: string;
};

export const BOOST_TIERS: BoostTier[] = [
  { id: "24h", label: "24 hours", days: 1, price: 99, blurb: "A quick lift to the top of the feed." },
  { id: "7d", label: "7 days", days: 7, price: 399, blurb: "Stay featured for a full week." },
  { id: "30d", label: "30 days", days: 30, price: 1299, blurb: "Maximum reach for a month." },
];

export function getBoostTier(id: string | null | undefined): BoostTier | null {
  return BOOST_TIERS.find((t) => t.id === id) ?? null;
}

export function isBoostActive(boostedUntil: Date | string | null | undefined): boolean {
  if (!boostedUntil) return false;
  return new Date(boostedUntil).getTime() > Date.now();
}
