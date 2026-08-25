-- Safe additive migration: move the Finuer Pro plan catalog out of code
-- (lib/finuer-pro.ts) and into an editable table so super-admin can change
-- pricing, duration and the feature bullets without a redeploy.
--
-- `slug` keeps the identity the app already stores in
-- user_preferences.finuer_pro_plan_id, so existing Pro grants keep resolving.

CREATE TABLE IF NOT EXISTS finuer_plans (
  id                       BIGSERIAL PRIMARY KEY,
  slug                     VARCHAR(40)  NOT NULL UNIQUE,
  label                    VARCHAR(120) NOT NULL,
  tagline                  VARCHAR(200) NULL,
  price_inr                NUMERIC(12, 2) NOT NULL DEFAULT 0,
  duration_days            INTEGER NULL,
  features                 TEXT[] NOT NULL DEFAULT '{}',
  unlocks_premium_baskets  BOOLEAN NOT NULL DEFAULT false,
  is_purchasable           BOOLEAN NOT NULL DEFAULT true,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  badge                    VARCHAR(40) NULL,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  updated_by_admin_id      BIGINT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finuer_plans_active_sort_idx
  ON finuer_plans (is_active, sort_order);

-- Seed the three plans that were previously hardcoded. ON CONFLICT DO NOTHING
-- makes this re-runnable and never clobbers an edit made from super-admin.
INSERT INTO finuer_plans
  (slug, label, tagline, price_inr, duration_days, features,
   unlocks_premium_baskets, is_purchasable, is_active, badge, sort_order)
VALUES
  ('free', 'Free', 'Everything you need to get started', 0, NULL,
   ARRAY['Public Finuer Baskets', 'Markets overview', 'Community feed'],
   false, false, true, NULL, 0),
  ('pro_monthly', 'Finuer Pro · Monthly', 'Full access, billed monthly', 499, 30,
   ARRAY['Everything in Free',
         'Premium Finuer Baskets (full holdings & returns)',
         'Pro-only competitions',
         'Priority support'],
   true, true, true, NULL, 1),
  ('pro_yearly', 'Finuer Pro · Yearly', 'Two months free versus monthly', 4999, 365,
   ARRAY['Everything in Pro Monthly',
         '2 months free vs monthly',
         'Premium Finuer Baskets',
         'Pro-only competitions'],
   true, true, true, 'Best value', 2)
ON CONFLICT (slug) DO NOTHING;
