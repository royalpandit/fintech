-- Subscription Services — PRD fields: category, yearly price, 7-day trial, paused.
-- Idempotent. ALTER TYPE ... ADD VALUE cannot run in a transaction.

DO $$ BEGIN
  CREATE TYPE service_category AS ENUM ('stocks','futures','options','commodity','currency','crypto');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE subscription_services
  ADD COLUMN IF NOT EXISTS category     service_category,
  ADD COLUMN IF NOT EXISTS yearly_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS has_trial    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_days   INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS paused       BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE service_subscriptions
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE;
