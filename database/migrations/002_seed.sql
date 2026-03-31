-- Flexi - Seed data (safe-ish for dev/staging; review before prod)

BEGIN;

-- Roles
INSERT INTO roles (name, description)
VALUES
  ('user', 'Normal end user'),
  ('advisor', 'SEBI-registered advisor'),
  ('admin', 'Super admin')
ON CONFLICT (name) DO NOTHING;

-- System expense categories
INSERT INTO expense_categories (name, parent_name, is_system)
VALUES
  ('Food', NULL, true),
  ('Travel', NULL, true),
  ('Investments', NULL, true),
  ('EMI', NULL, true),
  ('Utilities', NULL, true),
  ('Shopping', NULL, true),
  ('Health', NULL, true),
  ('Education', NULL, true),
  ('Rent', NULL, true),
  ('Subscriptions', NULL, true),
  ('Other', NULL, true)
ON CONFLICT (name) DO NOTHING;

-- Create an initial admin user (password hash placeholder!)
-- IMPORTANT: Replace password_hash with a real bcrypt hash in your environment.
INSERT INTO users (full_name, email, phone, password_hash, role, status, email_verified_at)
VALUES
  ('Flexi Admin', 'admin@flexi.local', '+910000000000', '$2b$10$REPLACE_WITH_BCRYPT_HASH', 'admin', 'active', now())
ON CONFLICT (email) DO NOTHING;

-- Demo advisor + wallet (optional)
INSERT INTO users (full_name, email, phone, password_hash, role, status, email_verified_at)
VALUES
  ('Demo Advisor', 'advisor@flexi.local', '+910000000001', '$2b$10$REPLACE_WITH_BCRYPT_HASH', 'advisor', 'active', now())
ON CONFLICT (email) DO NOTHING;

INSERT INTO advisor_profiles (user_id, sebi_registration_no, experience_years, bio, expertise_tags, verification_status, verified_at)
SELECT u.id, 'SEBI-DEMO-0001', 5, 'Demo advisor profile for QA/staging.', ARRAY['equity','risk'], 'approved', now()
FROM users u
WHERE u.email = 'advisor@flexi.local'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO advisor_wallets (advisor_user_id, balance)
SELECT u.id, 0
FROM users u
WHERE u.email = 'advisor@flexi.local'
ON CONFLICT (advisor_user_id) DO NOTHING;

-- Demo market post (approved)
INSERT INTO market_posts (
  advisor_user_id, title, content, asset_type, market_symbol, sentiment, risk_level,
  timeframe, target_price, stop_loss_price, disclaimer, compliance_status, published_at
)
SELECT
  u.id,
  'Banking sector outlook',
  'Informational view: banking sector looks bullish based on macro trends. Not investment advice.',
  'equity', 'NIFTYBANK', 'bullish', 'medium',
  '1-3 months', NULL, NULL,
  'This content is for informational purposes only and is not a recommendation.',
  'approved', now()
FROM users u
WHERE u.email = 'advisor@flexi.local';

COMMIT;

