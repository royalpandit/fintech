-- Safe additive migration: move the "Featured Analyst" sponsorship catalog out
-- of a hardcoded array in app/advisor/(shell)/services/feature-promote.tsx and
-- into an editable table, so super-admin can change pricing and duration
-- without a redeploy.
--
-- `slug` keeps the identity already stored in advisor_profiles.featured_tier
-- ('weekly' / 'monthly' / 'quarterly'), so advisors currently mid-placement
-- keep resolving to a real tier.

CREATE TABLE IF NOT EXISTS sponsorship_tiers (
  id                  BIGSERIAL PRIMARY KEY,
  slug                VARCHAR(40)  NOT NULL UNIQUE,
  label               VARCHAR(120) NOT NULL,
  tagline             VARCHAR(200) NULL,
  price_inr           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  duration_days       INTEGER NOT NULL,
  is_purchasable      BOOLEAN NOT NULL DEFAULT true,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  badge               VARCHAR(40) NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  updated_by_admin_id BIGINT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sponsorship_tiers_active_sort_idx
  ON sponsorship_tiers (is_active, sort_order);

-- Seed the three tiers that were previously hardcoded, at the prices the
-- advisor UI was already advertising. Re-runnable; never clobbers an edit.
INSERT INTO sponsorship_tiers
  (slug, label, tagline, price_inr, duration_days, is_purchasable, is_active, badge, sort_order)
VALUES
  ('weekly',    '1 week',   'Try a featured slot',              999, 7,  true, true, NULL,         0),
  ('monthly',   '1 month',  'Steady visibility on Trades',     2999, 30, true, true, NULL,         1),
  ('quarterly', '3 months', 'Best rate per day',               7499, 90, true, true, 'Best value', 2)
ON CONFLICT (slug) DO NOTHING;
