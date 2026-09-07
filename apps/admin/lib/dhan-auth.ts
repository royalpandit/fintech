/**
 * Dhan token management.
 *
 * Dhan access tokens last 24 hours, which makes the environment a poor place to
 * keep one: on Vercel changing an env var means redeploying the whole app for a
 * string with a one-day life, and locally it means restarting the dev server
 * every morning. So the current token lives in the database (app_credentials,
 * encrypted) where a super-admin can replace it from /super-admin/settings and
 * it takes effect on the next request.
 *
 * Resolution order, first hit wins:
 *   1. in-process cache          - avoids a query on every Dhan call
 *   2. app_credentials row       - what the super-admin panel writes
 *   3. .dhan-session.json        - legacy local file, still honoured
 *   4. DHAN_ACCESS_TOKEN env     - bootstrap and last resort
 *
 * The file store predates the table and only ever worked on a real filesystem;
 * on serverless it is per-instance and wiped between invocations. It is kept so
 * an existing local setup does not break, but the table is the supported path.
 */

import "server-only";

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { prisma } from "@/lib/prisma";
import { canEncryptSecrets, decryptSecret, encryptSecret, maskSecret } from "@/lib/secret-crypto";

const SESSION_PATH = join(process.cwd(), ".dhan-session.json");

/** The app_credentials key this module owns. */
export const DHAN_TOKEN_KEY = "dhan.accessToken";

interface DhanSession {
  accessToken: string;
  expiresAt: number; // epoch ms
}

export type DhanTokenSource = "database" | "session-file" | "env" | "none";

export type DhanTokenStatus = {
  present: boolean;
  valid: boolean;
  source: DhanTokenSource;
  /** Epoch ms, when the token itself declares one. */
  expiresAt: number | null;
  expiresInMs: number | null;
  masked: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

/* -- JWT expiry ---------------------------------------------------------- */

/**
 * Read the `exp` claim out of a Dhan token.
 *
 * The token is a JWT and states its own expiry, but nothing here used to look:
 * the old isDhanTokenValid() returned true whenever the env var was merely
 * *set*. So a token that died at 10:28 still counted as valid, every Dhan call
 * returned `808 Authentication Failed`, and the Markets tab sat empty for hours
 * with no indication of why. Decoding it means the panel can show a countdown
 * and the logs can say "expired", not just "401".
 *
 * Returns null for anything that is not a readable JWT - some deployments use
 * opaque tokens, and those are treated as "expiry unknown", not "expired".
 */
export function decodeTokenExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      exp?: number;
    };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/** A token with an expiry in the past - or within the next minute - is spent. */
function isExpired(expiresAt: number | null): boolean {
  return expiresAt != null && expiresAt <= Date.now() + 60_000;
}

/* -- cache --------------------------------------------------------------- */

/*
 * Every Dhan request needs the token, so reading the row each time would put a
 * query in front of every quote. Thirty seconds is short enough that a token
 * pasted into the panel takes effect almost immediately, and long enough that a
 * three-second quote poll does not query for it ten times a minute.
 */
const CACHE_TTL_MS = 30_000;

type Resolved = {
  token: string;
  source: DhanTokenSource;
  expiresAt: number | null;
  at: number;
};

let cache: Resolved | null = null;

/** Drop the cache so the next read sees a freshly stored token at once. */
export function invalidateDhanTokenCache(): void {
  cache = null;
}

/* -- stores -------------------------------------------------------------- */

function readSessionFile(): DhanSession | null {
  try {
    if (!existsSync(SESSION_PATH)) return null;
    return JSON.parse(readFileSync(SESSION_PATH, "utf-8")) as DhanSession;
  } catch {
    return null;
  }
}

async function readFromDatabase(): Promise<{ token: string; expiresAt: number | null } | null> {
  if (!canEncryptSecrets()) return null;
  try {
    const row = await prisma.appCredential.findUnique({ where: { key: DHAN_TOKEN_KEY } });
    if (!row) return null;
    const token = decryptSecret(row.value);
    // Unreadable ciphertext (rotated key, hand-edited row) is treated as
    // "nothing stored" so the env fallback still gets its chance.
    if (!token) return null;
    return { token, expiresAt: row.expiresAt ? row.expiresAt.getTime() : decodeTokenExpiry(token) };
  } catch {
    // The table may not exist yet on an install that has not run the migration.
    return null;
  }
}

/**
 * Store a token as the active one.
 *
 * Writes the database row when encryption is configured, and the legacy file
 * otherwise, so a local setup with no CREDENTIAL_SECRET still works.
 */
export async function storeDhanToken(
  accessToken: string,
  opts: { expiresInSeconds?: number; updatedById?: number } = {},
): Promise<{ expiresAt: number | null }> {
  const token = accessToken.trim();
  const declared = decodeTokenExpiry(token);
  // The token's own claim wins over anything the caller assumed.
  const expiresAt =
    declared ?? (opts.expiresInSeconds ? Date.now() + opts.expiresInSeconds * 1000 : null);

  if (canEncryptSecrets()) {
    const value = encryptSecret(token);
    const expires = expiresAt ? new Date(expiresAt) : null;
    await prisma.appCredential.upsert({
      where: { key: DHAN_TOKEN_KEY },
      create: {
        key: DHAN_TOKEN_KEY,
        value,
        expiresAt: expires,
        updatedById: opts.updatedById ?? null,
      },
      update: { value, expiresAt: expires, updatedById: opts.updatedById ?? null },
    });
  } else {
    writeFileSync(
      SESSION_PATH,
      JSON.stringify(
        { accessToken: token, expiresAt: expiresAt ?? Date.now() + 86_400_000 },
        null,
        2,
      ),
      "utf-8",
    );
  }

  invalidateDhanTokenCache();
  return { expiresAt };
}

/* -- resolution ---------------------------------------------------------- */

async function resolve(): Promise<Resolved | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;

  const fromDb = await readFromDatabase();
  if (fromDb && !isExpired(fromDb.expiresAt)) {
    cache = { ...fromDb, source: "database", at: Date.now() };
    return cache;
  }

  const session = readSessionFile();
  if (session?.accessToken) {
    const expiresAt = decodeTokenExpiry(session.accessToken) ?? session.expiresAt ?? null;
    if (!isExpired(expiresAt)) {
      cache = { token: session.accessToken, source: "session-file", expiresAt, at: Date.now() };
      return cache;
    }
  }

  const envToken = process.env.DHAN_ACCESS_TOKEN?.trim();
  if (envToken) {
    // Returned even when expired: a stale env token produces a clear 808 from
    // Dhan, which the Markets route turns into the Yahoo fallback. Withholding
    // it here would only make the failure less legible.
    cache = { token: envToken, source: "env", expiresAt: decodeTokenExpiry(envToken), at: Date.now() };
    return cache;
  }

  return null;
}

/** A usable access token, or throws with a message that says what to do. */
export async function getDhanAccessToken(): Promise<string> {
  const hit = await resolve();
  if (hit) {
    if (isExpired(hit.expiresAt)) {
      console.warn(
        `[DhanAuth] token from ${hit.source} expired at ${new Date(hit.expiresAt as number).toISOString()} - ` +
          "paste a fresh one at /super-admin/settings",
      );
    }
    return hit.token;
  }

  throw new Error(
    "Dhan access token not configured. Add one at /super-admin/settings, " +
      "or set DHAN_ACCESS_TOKEN in the environment.",
  );
}

/** True when a token is present and has not passed its stated expiry. */
export async function isDhanTokenValid(): Promise<boolean> {
  const hit = await resolve();
  return hit !== null && !isExpired(hit.expiresAt);
}

/** Everything the super-admin panel needs, with no secret in it. */
export async function getDhanTokenStatus(): Promise<DhanTokenStatus> {
  const hit = await resolve();
  if (!hit) {
    return {
      present: false,
      valid: false,
      source: "none",
      expiresAt: null,
      expiresInMs: null,
      masked: "",
      updatedAt: null,
      updatedBy: null,
    };
  }

  let updatedAt: string | null = null;
  let updatedBy: string | null = null;
  if (hit.source === "database") {
    try {
      const row = await prisma.appCredential.findUnique({
        where: { key: DHAN_TOKEN_KEY },
        include: { updatedBy: { select: { fullName: true } } },
      });
      updatedAt = row?.updatedAt.toISOString() ?? null;
      updatedBy = row?.updatedBy?.fullName ?? null;
    } catch {
      /* metadata is a nicety - never fail status over it */
    }
  }

  return {
    present: true,
    valid: !isExpired(hit.expiresAt),
    source: hit.source,
    expiresAt: hit.expiresAt,
    expiresInMs: hit.expiresAt ? hit.expiresAt - Date.now() : null,
    masked: maskSecret(hit.token),
    updatedAt,
    updatedBy,
  };
}
