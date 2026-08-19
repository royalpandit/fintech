import type { NextRequest } from "next/server";

/**
 * Shared-secret gate for /api/v1/cron/* routes.
 *
 * These endpoints run privileged background work (publishing posts, expiring
 * subscriptions, firing price alerts) with no user session, so they must not be
 * callable by anyone who guesses the URL.
 *
 * Accepts either:
 *   Authorization: Bearer <CRON_SECRET>      ← Vercel Cron sends this
 *   x-cron-secret: <CRON_SECRET>             ← convenient for curl / uptime pings
 */

/** Constant-time compare so a wrong secret can't be narrowed by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type CronAuthResult = { ok: true } | { ok: false; status: number; error: string };

export function authorizeCron(req: NextRequest): CronAuthResult {
  const secret = process.env.CRON_SECRET?.trim();

  // Fail closed: without a configured secret these routes stay shut rather
  // than running unauthenticated.
  if (!secret) {
    return { ok: false, status: 503, error: "CRON_SECRET is not configured" };
  }

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const header = req.headers.get("x-cron-secret")?.trim();
  const supplied = bearer || header;

  if (!supplied || !safeEqual(supplied, secret)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
