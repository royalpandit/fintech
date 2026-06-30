import type { SubscriptionServiceCategory } from "@prisma/client";

export type ServicePlanType = "monthly" | "yearly" | "trial";

export const SERVICE_CATEGORIES: { value: SubscriptionServiceCategory; label: string }[] = [
  { value: "stocks", label: "Stocks" },
  { value: "futures", label: "Futures" },
  { value: "options", label: "Options" },
  { value: "commodity", label: "Commodity" },
  { value: "currency", label: "Currency" },
  { value: "crypto", label: "Crypto" },
];

export const CATEGORY_LABEL: Record<SubscriptionServiceCategory, string> = {
  stocks: "Stocks",
  futures: "Futures",
  options: "Options",
  commodity: "Commodity",
  currency: "Currency",
  crypto: "Crypto",
};

export const TRIAL_DAYS = 7;
export const ADVISOR_REVENUE_SHARE = 0.8;

export function categoryLabel(cat: SubscriptionServiceCategory): string {
  return CATEGORY_LABEL[cat] ?? cat;
}

export function yearlySavingsPct(monthly: number, yearly: number): number {
  if (!monthly || !yearly) return 0;
  const fullYearMonthly = monthly * 12;
  if (fullYearMonthly <= yearly) return 0;
  return Math.round(((fullYearMonthly - yearly) / fullYearMonthly) * 100);
}

export function planPrice(
  service: { monthlyPrice: unknown; yearlyPrice: unknown },
  plan: ServicePlanType,
): number {
  if (plan === "yearly") return Number(service.yearlyPrice);
  if (plan === "monthly") return Number(service.monthlyPrice);
  return 0;
}

export function planEndDate(plan: ServicePlanType, from = new Date()): Date {
  const end = new Date(from);
  if (plan === "trial") {
    end.setDate(end.getDate() + TRIAL_DAYS);
    return end;
  }
  if (plan === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
    return end;
  }
  end.setMonth(end.getMonth() + 1);
  return end;
}

export function isSubscriptionActive(sub: {
  status: string;
  endDate: Date | string | null;
} | null): boolean {
  if (!sub || sub.status !== "active") return false;
  if (!sub.endDate) return false;
  return new Date(sub.endDate).getTime() > Date.now();
}

export function serializeService(service: {
  id: number;
  advisorUserId: number;
  name: string;
  category: SubscriptionServiceCategory;
  description: string;
  monthlyPrice: unknown;
  yearlyPrice: unknown;
  offerFreeTrial: boolean;
  status: string;
  pauseNewSubscriptions: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { subscriptions: number };
}) {
  const monthly = Number(service.monthlyPrice);
  const yearly = Number(service.yearlyPrice);
  return {
    id: service.id,
    advisorUserId: service.advisorUserId,
    name: service.name,
    category: service.category,
    categoryLabel: categoryLabel(service.category),
    description: service.description,
    monthlyPrice: monthly,
    yearlyPrice: yearly,
    yearlySavingsPct: yearlySavingsPct(monthly, yearly),
    offerFreeTrial: service.offerFreeTrial,
    status: service.status,
    pauseNewSubscriptions: service.pauseNewSubscriptions,
    subscriberCount: service._count?.subscriptions ?? 0,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}
