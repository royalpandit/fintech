-- Operator-managed secrets that rotate too often to live in the environment.
--
-- The Dhan access token is the case that forced this: it expires every 24
-- hours, and on Vercel changing an env var means redeploying the whole app for
-- a string with a one-day life. A row here takes effect on the next request.
--
-- "value" holds AES-256-GCM ciphertext (lib/secret-crypto.ts), never plaintext.
-- "expires_at" is decoded from the credential itself where possible, so the
-- panel can show a real countdown instead of assuming 24 hours.
CREATE TABLE IF NOT EXISTS "app_credentials" (
  "id"            SERIAL PRIMARY KEY,
  "key"           VARCHAR(80) NOT NULL UNIQUE,
  "value"         TEXT        NOT NULL,
  "expires_at"    TIMESTAMP(3),
  "updated_by_id" INTEGER,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_credentials_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);
