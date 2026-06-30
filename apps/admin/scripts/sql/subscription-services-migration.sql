-- Advisor subscription services (per-service plans with monthly/yearly pricing)

DO $$ BEGIN
  CREATE TYPE subscription_service_category AS ENUM (
    'stocks', 'futures', 'options', 'commodity', 'currency', 'crypto'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_service_status AS ENUM ('active', 'paused', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS advisor_subscription_services (
  id SERIAL PRIMARY KEY,
  advisor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  category subscription_service_category NOT NULL,
  description TEXT NOT NULL,
  monthly_price DECIMAL(12, 2) NOT NULL,
  yearly_price DECIMAL(12, 2) NOT NULL,
  offer_free_trial BOOLEAN NOT NULL DEFAULT FALSE,
  status subscription_service_status NOT NULL DEFAULT 'active',
  pause_new_subscriptions BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS advisor_subscription_services_advisor_status_idx
  ON advisor_subscription_services(advisor_user_id, status);
CREATE INDEX IF NOT EXISTS advisor_subscription_services_category_idx
  ON advisor_subscription_services(category);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES advisor_subscription_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS subscriptions_service_id_idx ON subscriptions(service_id);

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_service_id_key UNIQUE (user_id, service_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
