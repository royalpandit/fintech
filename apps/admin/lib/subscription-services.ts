import { prisma } from "@/lib/prisma";
// Pure category helpers live in a prisma-free module so client components can use
// them without pulling `pg` into the browser bundle. Re-exported here for server code.
export {
  SERVICE_CATEGORIES,
  categoryLabel,
  yearlySavingsPct,
  isServiceCategory,
  type ServiceCategory,
} from "@/lib/service-categories";

// Subscription Services — per-analyst plans/bundles and per-service ownership.
// See SUBSCRIPTION-SERVICES-CHANGES.md.

export type ServiceWithCount = {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  yearlyPrice: number | null;
  hasTrial: boolean;
  trialDays: number;
  paused: boolean;
  isBundle: boolean;
  subscriberCount: number;
};

/** Active services for an analyst, each with its owner count (for filter chips). */
export async function advisorServices(
  advisorUserId: number,
  opts?: { activeOnly?: boolean },
): Promise<ServiceWithCount[]> {
  const services = await prisma.subscriptionService.findMany({
    where: { advisorUserId, ...(opts?.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { subscriptions: { where: { status: "active" } } } } },
  });
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    price: Number(s.price),
    yearlyPrice: s.yearlyPrice != null ? Number(s.yearlyPrice) : null,
    hasTrial: s.hasTrial,
    trialDays: s.trialDays,
    paused: s.paused,
    isBundle: s.isBundle,
    subscriberCount: s._count.subscriptions,
  }));
}


/** Set of service IDs a user owns from an analyst (direct + bundle expansion). */
export async function userOwnedServiceIds(
  userId: number,
  advisorUserId: number,
): Promise<Set<number>> {
  const owned = await prisma.serviceSubscription.findMany({
    where: {
      userId,
      advisorUserId,
      status: "active",
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
    select: { serviceId: true, service: { select: { isBundle: true } } },
  });
  const ids = new Set<number>(owned.map((o) => o.serviceId));

  // Expand any owned bundles into their member services.
  const bundleIds = owned.filter((o) => o.service.isBundle).map((o) => o.serviceId);
  if (bundleIds.length) {
    const members = await prisma.serviceBundleItem.findMany({
      where: { bundleId: { in: bundleIds } },
      select: { serviceId: true },
    });
    members.forEach((m) => ids.add(m.serviceId));
  }
  return ids;
}

/**
 * User IDs who own any of the given services from an analyst — including via a
 * bundle that contains one of them. Used for broadcast targeting + trade audience.
 */
export async function subscribersForServiceIds(
  advisorUserId: number,
  serviceIds: number[],
): Promise<number[]> {
  if (serviceIds.length === 0) return [];

  // Bundles that contain any of the requested services also grant access.
  const bundles = await prisma.serviceBundleItem.findMany({
    where: { serviceId: { in: serviceIds } },
    select: { bundleId: true },
  });
  const targetIds = [...new Set([...serviceIds, ...bundles.map((b) => b.bundleId)])];

  const subs = await prisma.serviceSubscription.findMany({
    where: {
      advisorUserId,
      serviceId: { in: targetIds },
      status: "active",
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
    select: { userId: true },
  });
  return [...new Set(subs.map((s) => s.userId))];
}

export const ADVISOR_REVENUE_SHARE = 0.8;

export function isSubscriptionActive(sub: {
  status: string;
  endDate?: Date | string | null;
} | null | undefined): boolean {
  if (!sub || sub.status !== "active") return false;
  if (!sub.endDate) return true;
  return new Date(sub.endDate).getTime() > Date.now();
}

/** Map of userId → owned service names for an analyst (for chat badges). */
export async function subscriberServiceNames(
  advisorUserId: number,
): Promise<Map<number, string[]>> {
  const subs = await prisma.serviceSubscription.findMany({
    where: {
      advisorUserId,
      status: "active",
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
    select: { userId: true, service: { select: { name: true } } },
  });
  const map = new Map<number, string[]>();
  for (const s of subs) {
    const list = map.get(s.userId) ?? [];
    list.push(s.service.name);
    map.set(s.userId, list);
  }
  return map;
}
