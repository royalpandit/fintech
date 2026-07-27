-- Subscription Services — per-analyst named plans / bundles + per-service
-- ownership. Keystone for message filters, chat badges, broadcast targeting and
-- trade "publish to a service". Idempotent. REVERT: subscription-services-rollback.sql

CREATE TABLE IF NOT EXISTS subscription_services (
  id              SERIAL PRIMARY KEY,
  advisor_user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name            VARCHAR(80) NOT NULL,
  description     TEXT,
  price           DECIMAL(12, 2) NOT NULL,
  is_bundle       BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS subscription_services_advisor_idx ON subscription_services (advisor_user_id);

CREATE TABLE IF NOT EXISTS service_bundle_items (
  bundle_id  INTEGER NOT NULL REFERENCES subscription_services (id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES subscription_services (id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, service_id)
);

CREATE TABLE IF NOT EXISTS service_subscriptions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  advisor_user_id INTEGER NOT NULL,
  service_id      INTEGER NOT NULL REFERENCES subscription_services (id) ON DELETE CASCADE,
  status          subscription_status NOT NULL DEFAULT 'active',
  start_date      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date        TIMESTAMP(3),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_subscriptions_user_service_key UNIQUE (user_id, service_id)
);
CREATE INDEX IF NOT EXISTS service_subscriptions_advisor_idx ON service_subscriptions (advisor_user_id);
CREATE INDEX IF NOT EXISTS service_subscriptions_service_idx ON service_subscriptions (service_id);
