/**
 * Dhan token management.
 *
 * Dhan access tokens are valid for 24 h. This module stores the most-recent
 * token in a local JSON file (.dhan-session.json, git-ignored) so it survives
 * server restarts without needing a DB migration.  When the admin re-authorises
 * via the OAuth flow (/api/v1/auth/dhan/callback) the file is overwritten and
 * all subsequent API calls pick up the new token automatically.
 */

import "server-only";

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SESSION_PATH = join(process.cwd(), ".dhan-session.json");

interface DhanSession {
  accessToken: string;
  expiresAt: number; // epoch ms
}

function readSession(): DhanSession | null {
  try {
    if (!existsSync(SESSION_PATH)) return null;
    return JSON.parse(readFileSync(SESSION_PATH, "utf-8")) as DhanSession;
  } catch {
    return null;
  }
}

export function storeDhanToken(accessToken: string, expiresInSeconds = 86_400) {
  const session: DhanSession = {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1_000,
  };
  writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2), "utf-8");
}

/** Returns a valid access token or throws with a clear message. */
export function getDhanAccessToken(): string {
  // 1. Try the persisted session (set by the OAuth callback)
  const session = readSession();
  if (session && session.expiresAt > Date.now() + 60_000) {
    return session.accessToken;
  }

  // 2. Fall back to env (useful for local dev: paste a fresh 24-h token in .env)
  const envToken = process.env.DHAN_ACCESS_TOKEN?.trim();
  if (envToken) return envToken;

  throw new Error(
    "Dhan access token expired or not configured. " +
      "Re-authorise at /api/v1/admin/dhan/authorize (super-admin only).",
  );
}

/** Returns true if we have a token that is still valid for at least 60 s. */
export function isDhanTokenValid(): boolean {
  const session = readSession();
  if (session && session.expiresAt > Date.now() + 60_000) return true;
  return Boolean(process.env.DHAN_ACCESS_TOKEN?.trim());
}

export function getDhanTokenStatus(): { valid: boolean; expiresAt: number | null } {
  const session = readSession();
  if (session) return { valid: session.expiresAt > Date.now() + 60_000, expiresAt: session.expiresAt };
  if (process.env.DHAN_ACCESS_TOKEN?.trim()) return { valid: true, expiresAt: null };
  return { valid: false, expiresAt: null };
}
