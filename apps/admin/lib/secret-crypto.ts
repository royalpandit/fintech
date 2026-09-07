import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Authenticated encryption for credentials held in the database.
 *
 * These rows are operator secrets — a broker access token is enough to read a
 * live trading account — so they are not stored as plaintext a stray query,
 * backup or log line could expose. AES-256-GCM rather than CBC because GCM
 * authenticates: a row edited directly in the database fails to decrypt instead
 * of silently yielding a different token.
 *
 * This is protection against incidental exposure of the data at rest, not
 * against an attacker who already has the application's environment. Anyone
 * holding CREDENTIAL_SECRET can decrypt these, by design — the server has to.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits, the size GCM is specified for
const VERSION = "v1";

/**
 * The key is derived from CREDENTIAL_SECRET, falling back to JWT_SECRET so an
 * existing deployment keeps working without a new variable to set. Note the
 * consequence: if you later add CREDENTIAL_SECRET to an install that had been
 * using JWT_SECRET, previously stored values stop decrypting and have to be
 * re-entered. Rotating JWT_SECRET has the same effect.
 *
 * SHA-256 of the passphrase, not the raw bytes, so any length of secret yields
 * the 32 bytes AES-256 requires.
 */
function key(): Buffer {
  const secret = (process.env.CREDENTIAL_SECRET || process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw new Error(
      "Cannot encrypt stored credentials: set CREDENTIAL_SECRET (or JWT_SECRET) in the environment.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

/** True when a key is configured, so callers can degrade instead of throwing. */
export function canEncryptSecrets(): boolean {
  return Boolean((process.env.CREDENTIAL_SECRET || process.env.JWT_SECRET || "").trim());
}

/** Encrypt to "v1:<iv>:<authTag>:<ciphertext>", all base64url. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

/**
 * Reverse of encryptSecret. Returns null rather than throwing for anything
 * unreadable — a rotated key or a hand-edited row should degrade to "no
 * credential stored", which the caller can fall back from, not crash a request
 * path that had a working environment fallback available.
 */
export function decryptSecret(stored: string): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = stored.split(":");
    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Last 4 characters behind a fixed-width mask, for display.
 *
 * Fixed width on purpose: showing the true length of a secret leaks something
 * about it, and the tail is enough to answer "is this the token I just pasted?"
 */
export function maskSecret(plaintext: string): string {
  const tail = plaintext.slice(-4);
  return tail ? `${"•".repeat(8)}${tail}` : "";
}
