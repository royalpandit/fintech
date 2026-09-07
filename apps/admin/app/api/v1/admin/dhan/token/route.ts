import { type NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DHAN_TOKEN_KEY,
  decodeTokenExpiry,
  getDhanTokenStatus,
  invalidateDhanTokenCache,
  storeDhanToken,
} from "@/lib/dhan-auth";
import { canEncryptSecrets } from "@/lib/secret-crypto";
import { getLTP } from "@/lib/dhan";

export const dynamic = "force-dynamic";

/**
 * Super-admin management of the Dhan access token.
 *
 * The token expires every 24 hours. Keeping it in the environment means a
 * Vercel redeploy (or a dev-server restart) to change a string with a one-day
 * life, so it lives in app_credentials instead and this is where it is set.
 *
 *   GET    - status only. Never returns the token; a masked tail and an expiry.
 *   PUT    - store a new token, after checking it actually works.
 *   DELETE - drop the stored token and fall back to the environment.
 *
 * super_admin only: this credential can read a live trading account.
 */

/** NIFTY 50 on the index segment - the cheapest call that proves a token. */
const PROBE = [{ exchange: "IDX_I", symboltoken: "13" }];

/** Empty string means the token works; anything else is the reason it does not. */
async function probeToken(): Promise<string> {
  try {
    const rows = await getLTP(PROBE);
    const ltp = Number(rows[0]?.ltp);
    if (!Number.isFinite(ltp) || ltp <= 0) {
      return "Dhan accepted the token but returned no price.";
    }
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : "Dhan request failed";
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    ok: true,
    status: await getDhanTokenStatus(),
    // Without an encryption key there is nowhere safe to put the token, so the
    // form tells the operator that rather than silently writing a file that
    // will not survive on serverless.
    storageReady: canEncryptSecrets(),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = (body.token ?? "").trim();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Paste a token first." }, { status: 400 });
  }
  if (token.length < 40) {
    return NextResponse.json(
      { ok: false, error: "That does not look like a Dhan access token." },
      { status: 400 },
    );
  }

  // Reject an already-expired token at the door. Pasting yesterday's by mistake
  // is easy, and the failure it causes downstream (an empty Markets tab) points
  // nowhere near the cause.
  const expiresAt = decodeTokenExpiry(token);
  if (expiresAt != null && expiresAt <= Date.now()) {
    return NextResponse.json(
      {
        ok: false,
        error: `That token expired on ${new Date(expiresAt).toLocaleString("en-IN")}. Generate a new one in Dhan.`,
      },
      { status: 400 },
    );
  }

  /*
   * Store first, then probe.
   *
   * getLTP reads the token through the same resolution path everything else
   * uses, so the only way to test the new one is for it to be the active one.
   * A failed probe rolls back to whatever was there before, so a bad paste
   * cannot leave the platform worse off than it started.
   */
  const previous = await prisma.appCredential
    .findUnique({ where: { key: DHAN_TOKEN_KEY } })
    .catch(() => null);

  await storeDhanToken(token, { updatedById: auth.userId });

  const probeError = await probeToken();
  if (probeError) {
    if (previous) {
      await prisma.appCredential.update({
        where: { key: DHAN_TOKEN_KEY },
        data: {
          value: previous.value,
          expiresAt: previous.expiresAt,
          updatedById: previous.updatedById,
        },
      });
    } else {
      await prisma.appCredential.delete({ where: { key: DHAN_TOKEN_KEY } }).catch(() => {});
    }
    invalidateDhanTokenCache();
    return NextResponse.json(
      { ok: false, error: `Dhan rejected that token - ${probeError}` },
      { status: 400 },
    );
  }

  // The token itself is never written to the log; only that it changed.
  await prisma.auditLog
    .create({
      data: {
        actorUserId: auth.userId,
        action: "dhan.token.updated",
        module: "settings",
        targetKind: "credential",
        payload: {
          key: DHAN_TOKEN_KEY,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
        ipAddress: req.headers.get("x-forwarded-for") ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, status: await getDhanTokenStatus() });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  await prisma.appCredential.delete({ where: { key: DHAN_TOKEN_KEY } }).catch(() => {});
  invalidateDhanTokenCache();

  await prisma.auditLog
    .create({
      data: {
        actorUserId: auth.userId,
        action: "dhan.token.cleared",
        module: "settings",
        targetKind: "credential",
        payload: { key: DHAN_TOKEN_KEY },
        ipAddress: req.headers.get("x-forwarded-for") ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, status: await getDhanTokenStatus() });
}
