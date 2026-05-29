-- Safe additive migration: user settings tables (matches bigint user ids)

CREATE TABLE IF NOT EXISTS user_preferences (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme             VARCHAR(20) NOT NULL DEFAULT 'light',
  language          VARCHAR(10) NOT NULL DEFAULT 'en',
  default_currency  VARCHAR(10) NOT NULL DEFAULT 'INR',
  biometric_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences(user_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  in_app_enabled    BOOLEAN NOT NULL DEFAULT true,
  push_enabled      BOOLEAN NOT NULL DEFAULT true,
  email_enabled     BOOLEAN NOT NULL DEFAULT true,
  market_alerts     BOOLEAN NOT NULL DEFAULT true,
  portfolio_alerts  BOOLEAN NOT NULL DEFAULT true,
  budget_alerts     BOOLEAN NOT NULL DEFAULT true,
  social_alerts     BOOLEAN NOT NULL DEFAULT true,
  advisor_alerts    BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS notification_preferences_user_id_idx ON notification_preferences(user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_preferences_updated_at') THEN
      CREATE TRIGGER trg_user_preferences_updated_at
        BEFORE UPDATE ON user_preferences
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
  END IF;
END $$;
