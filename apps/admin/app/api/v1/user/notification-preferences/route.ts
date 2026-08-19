import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Notification preferences. The settings UI rendered these as plain
 * `defaultChecked` inputs with no handler and no endpoint behind them, so
 * toggling a channel or category changed nothing and reverted on refresh.
 */

const FIELDS = [
  "inAppEnabled",
  "pushEnabled",
  "emailEnabled",
  "marketAlerts",
  "portfolioAlerts",
  "budgetAlerts",
  "socialAlerts",
  "advisorAlerts",
] as const;

type Field = (typeof FIELDS)[number];

/** Everything defaults to on, matching what the UI shows for a new user. */
const DEFAULTS: Record<Field, boolean> = {
  inAppEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
  marketAlerts: true,
  portfolioAlerts: true,
  budgetAlerts: true,
  socialAlerts: true,
  advisorAlerts: true,
};

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: auth.userId },
  });

  const data = { ...DEFAULTS };
  if (prefs) {
    for (const f of FIELDS) data[f] = prefs[f];
  }
  return ok({ preferences: data });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<Partial<Record<Field, unknown>>>(req);

  // Only accept known booleans — a partial body updates just those keys.
  const patch: Partial<Record<Field, boolean>> = {};
  for (const f of FIELDS) {
    if (typeof body[f] === "boolean") patch[f] = body[f] as boolean;
  }
  if (!Object.keys(patch).length) {
    return err("No valid preference fields supplied");
  }

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: auth.userId },
    update: patch,
    // A row may not exist yet, so seed the untouched fields with the defaults.
    create: { userId: auth.userId, ...DEFAULTS, ...patch },
  });

  const data = { ...DEFAULTS };
  for (const f of FIELDS) data[f] = prefs[f];
  return ok({ preferences: data });
}
