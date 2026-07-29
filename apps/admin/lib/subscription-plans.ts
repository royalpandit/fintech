// Paid subscription plans (display pricing only — no payment is processed).
// A monthly/yearly subscription is what unlocks 1-to-1 chat with an advisor.

export type SubPlanId = "monthly" | "yearly";

export type SubPlan = {
  id: SubPlanId;
  label: string;
  price: number; // INR, display-only
  months: number;
};

export const SUB_PLANS: Record<SubPlanId, SubPlan> = {
  monthly: { id: "monthly", label: "Monthly", price: 299, months: 1 },
  yearly: { id: "yearly", label: "Yearly", price: 2499, months: 12 },
};

export function getSubPlan(id: string | null | undefined): SubPlan | null {
  if (id === "monthly" || id === "yearly") return SUB_PLANS[id];
  return null;
}

/** A subscription grants chat if it's active and not expired. */
export function isChatActive(sub: { status: string; endDate: Date | string | null } | null): boolean {
  if (!sub || sub.status !== "active") return false;
  if (!sub.endDate) return false;
  return new Date(sub.endDate).getTime() > Date.now();
}

export function inferPlanLabel(amount: number | string): string {
  const n = Number(amount);
  if (n === SUB_PLANS.monthly.price) return "Monthly";
  if (n === SUB_PLANS.yearly.price) return "Yearly";
  if (n === 0) return "Free follow";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function inferPlanId(amount: number | string): SubPlanId | "free" | "custom" {
  const n = Number(amount);
  if (n === SUB_PLANS.monthly.price) return "monthly";
  if (n === SUB_PLANS.yearly.price) return "yearly";
  if (n === 0) return "free";
  return "custom";
}

export function subscriptionDisplayStatus(sub: {
  status: string;
  endDate: Date | string | null;
}): string {
  if (sub.status === "cancelled") return "cancelled";
  if (sub.status === "pending") return "pending";
  if (sub.status === "expired") return "expired";
  if (sub.endDate && new Date(sub.endDate).getTime() <= Date.now()) return "expired";
  return sub.status;
}
