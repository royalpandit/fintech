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
