import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { isPushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

/** GET — is push available, and is this browser already registered? */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const endpoint = req.nextUrl.searchParams.get("endpoint");
  const count = await prisma.webPushSubscription.count({ where: { userId: auth.userId } });
  const thisBrowser = endpoint
    ? Boolean(
        await prisma.webPushSubscription.findFirst({
          where: { userId: auth.userId, endpoint },
          select: { id: true },
        }),
      )
    : false;

  return ok({ configured: isPushConfigured(), devices: count, subscribed: thisBrowser });
}

/** POST — register this browser's push endpoint. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  if (!isPushConfigured()) return err("Push is not configured on the server", 503);

  const body = await parseBody<{
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  }>(req);

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const authKey = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !authKey) {
    return err("endpoint and keys.p256dh / keys.auth are required");
  }

  // Endpoint is unique — re-subscribing the same browser (or one that moved
  // between accounts) updates the row rather than erroring.
  const sub = await prisma.webPushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: auth.userId,
      p256dh,
      auth: authKey,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    create: {
      userId: auth.userId,
      endpoint,
      p256dh,
      auth: authKey,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });

  return ok({ subscribed: true, id: sub.id });
}

/** DELETE — unregister this browser. */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{ endpoint?: string }>(req);
  const endpoint = body.endpoint?.trim() ?? req.nextUrl.searchParams.get("endpoint")?.trim();
  if (!endpoint) return err("endpoint is required");

  await prisma.webPushSubscription.deleteMany({ where: { userId: auth.userId, endpoint } });
  return ok({ subscribed: false });
}
