-- Finuer Pro entitlement on user preferences (admin-grantable until payments are wired).
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS finuer_pro_plan_id VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS finuer_pro_expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_user_preferences_finuer_pro_expires
  ON user_preferences (finuer_pro_expires_at)
  WHERE finuer_pro_expires_at IS NOT NULL;
