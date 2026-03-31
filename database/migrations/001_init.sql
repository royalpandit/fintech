-- Flexi - Initial production schema
-- Safe to run once on an empty database.

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Utility
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'advisor', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE account_status AS ENUM ('active', 'suspended', 'pending');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_document_type') THEN
    CREATE TYPE kyc_document_type AS ENUM ('pan', 'aadhaar', 'sebi_cert', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sentiment_type') THEN
    CREATE TYPE sentiment_type AS ENUM ('bullish', 'bearish', 'neutral');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_type') THEN
    CREATE TYPE asset_type AS ENUM ('equity', 'crypto', 'mf', 'commodity', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level') THEN
    CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compliance_status') THEN
    CREATE TYPE compliance_status AS ENUM ('pending', 'approved', 'flagged', 'rejected', 'under_review');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_visibility') THEN
    CREATE TYPE post_visibility AS ENUM ('public', 'followers', 'group');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_type') THEN
    CREATE TYPE reaction_type AS ENUM ('like');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'txn_type') THEN
    CREATE TYPE txn_type AS ENUM ('debit', 'credit');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_side') THEN
    CREATE TYPE trade_side AS ENUM ('buy', 'sell');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'pending', 'past_due');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('created', 'success', 'failed', 'refunded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE payout_status AS ENUM ('requested', 'processing', 'paid', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM ('in_app', 'push', 'email');
  END IF;
END$$;

-- =========================
-- 1) Identity & Access
-- =========================

CREATE TABLE IF NOT EXISTS roles (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         user_role NOT NULL UNIQUE,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid              UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  full_name         VARCHAR(150) NOT NULL,
  email             CITEXT NOT NULL UNIQUE,
  phone             VARCHAR(20) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  role              user_role NOT NULL DEFAULT 'user',
  status            account_status NOT NULL DEFAULT 'active',
  email_verified_at TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_sessions (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id      VARCHAR(128),
  user_agent     TEXT,
  ip_address     INET,
  refresh_token_hash TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type       kyc_document_type NOT NULL,
  document_number_enc TEXT,
  document_file_url   TEXT,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verified_by_admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verified_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_kyc_documents_updated_at ON kyc_documents;
CREATE TRIGGER trg_kyc_documents_updated_at
BEFORE UPDATE ON kyc_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON kyc_documents(verification_status);

CREATE TABLE IF NOT EXISTS consent_logs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type  VARCHAR(100) NOT NULL, -- portfolio, upi, marketing, etc.
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  metadata      JSONB
);
CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_type ON consent_logs(consent_type);

-- =========================
-- 2) Advisor module
-- =========================

CREATE TABLE IF NOT EXISTS advisor_profiles (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  sebi_registration_no VARCHAR(100) NOT NULL UNIQUE,
  experience_years    INT,
  bio                 TEXT,
  expertise_tags      TEXT[] NOT NULL DEFAULT '{}',
  profile_image_url   TEXT,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verified_by_admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verified_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_advisor_profiles_updated_at ON advisor_profiles;
CREATE TRIGGER trg_advisor_profiles_updated_at
BEFORE UPDATE ON advisor_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS advisor_metrics_daily (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  advisor_user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day                DATE NOT NULL,
  followers_count    INT NOT NULL DEFAULT 0,
  subscribers_count  INT NOT NULL DEFAULT 0,
  posts_count        INT NOT NULL DEFAULT 0,
  accuracy_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
  roi_pct            NUMERIC(7,2) NOT NULL DEFAULT 0,
  earnings_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (advisor_user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_advisor_metrics_daily_day ON advisor_metrics_daily(day);

-- =========================
-- 3) Market sentiment (advisor-only posts)
-- =========================

CREATE TABLE IF NOT EXISTS market_posts (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid              UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  advisor_user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(200) NOT NULL,
  content           TEXT NOT NULL,
  asset_type        asset_type NOT NULL,
  market_symbol     VARCHAR(50),
  sentiment         sentiment_type NOT NULL,
  risk_level        risk_level NOT NULL,
  timeframe         VARCHAR(50),
  target_price      NUMERIC(18,4),
  stop_loss_price   NUMERIC(18,4),
  disclaimer        TEXT NOT NULL,
  compliance_status compliance_status NOT NULL DEFAULT 'pending',
  compliance_risk_score NUMERIC(5,2),
  published_at      TIMESTAMPTZ,
  edited_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT chk_market_posts_prices CHECK (
    (target_price IS NULL OR target_price >= 0) AND
    (stop_loss_price IS NULL OR stop_loss_price >= 0)
  )
);
DROP TRIGGER IF EXISTS trg_market_posts_updated_at ON market_posts;
CREATE TRIGGER trg_market_posts_updated_at
BEFORE UPDATE ON market_posts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_market_posts_advisor ON market_posts(advisor_user_id);
CREATE INDEX IF NOT EXISTS idx_market_posts_symbol ON market_posts(market_symbol);
CREATE INDEX IF NOT EXISTS idx_market_posts_created_at ON market_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_posts_compliance_status ON market_posts(compliance_status);

CREATE TABLE IF NOT EXISTS market_comments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES market_posts(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   BIGINT REFERENCES market_comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  toxicity_score NUMERIC(5,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_market_comments_post ON market_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_market_comments_user ON market_comments(user_id);

CREATE TABLE IF NOT EXISTS market_reactions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES market_posts(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        reaction_type NOT NULL DEFAULT 'like',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, type)
);
CREATE INDEX IF NOT EXISTS idx_market_reactions_post ON market_reactions(post_id);

CREATE TABLE IF NOT EXISTS content_reports (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_kind    VARCHAR(50) NOT NULL, -- market_post, market_comment, community_post, community_comment, dm
  content_id      BIGINT NOT NULL,
  reason          TEXT NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'open', -- open, in_review, resolved, rejected
  resolved_by_admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_kind_id ON content_reports(content_kind, content_id);

CREATE TABLE IF NOT EXISTS sentiment_aggregates (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  market_symbol   VARCHAR(50) NOT NULL,
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,
  bullish_count   INT NOT NULL DEFAULT 0,
  bearish_count   INT NOT NULL DEFAULT 0,
  neutral_count   INT NOT NULL DEFAULT 0,
  aggregated_score NUMERIC(6,3) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (market_symbol, window_start, window_end)
);
CREATE INDEX IF NOT EXISTS idx_sentiment_aggregates_symbol ON sentiment_aggregates(market_symbol);

-- =========================
-- 4) Community (non-market) social
-- =========================

CREATE TABLE IF NOT EXISTS community_posts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  media_url   TEXT,
  category    VARCHAR(50) NOT NULL DEFAULT 'general',
  visibility  post_visibility NOT NULL DEFAULT 'public',
  group_id    BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS trg_community_posts_updated_at ON community_posts;
CREATE TRIGGER trg_community_posts_updated_at
BEFORE UPDATE ON community_posts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS community_comments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   BIGINT REFERENCES community_comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  toxicity_score NUMERIC(5,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS community_post_saves (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_follows (
  follower_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_user_id, following_user_id),
  CONSTRAINT chk_user_follows_no_self CHECK (follower_user_id <> following_user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_user_id);

CREATE TABLE IF NOT EXISTS groups (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  created_by  BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id    BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'member', -- member, moderator, owner
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

CREATE TABLE IF NOT EXISTS reputation_logs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points        INT NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  reference_kind VARCHAR(50),
  reference_id  BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reputation_logs_user ON reputation_logs(user_id, created_at DESC);

-- Direct messaging (encrypted at application layer)
CREATE TABLE IF NOT EXISTS dm_threads (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dm_thread_participants (
  thread_id   BIGINT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  thread_id   BIGINT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_enc TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_dm_messages_thread ON dm_messages(thread_id, created_at);

-- =========================
-- 5) Portfolio (real) & analytics
-- =========================

CREATE TABLE IF NOT EXISTS broker_accounts (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_name     VARCHAR(100) NOT NULL,
  oauth_token_enc TEXT,
  refresh_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, broker_name)
);
DROP TRIGGER IF EXISTS trg_broker_accounts_updated_at ON broker_accounts;
CREATE TRIGGER trg_broker_accounts_updated_at
BEFORE UPDATE ON broker_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS portfolios (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source        VARCHAR(20) NOT NULL DEFAULT 'broker', -- broker/manual
  name          VARCHAR(120) NOT NULL DEFAULT 'Default',
  currency      VARCHAR(10) NOT NULL DEFAULT 'INR',
  total_value   NUMERIC(18,2) NOT NULL DEFAULT 0,
  day_change    NUMERIC(18,2) NOT NULL DEFAULT 0,
  risk_score    NUMERIC(5,2) NOT NULL DEFAULT 0,
  diversification_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS trg_portfolios_updated_at ON portfolios;
CREATE TRIGGER trg_portfolios_updated_at
BEFORE UPDATE ON portfolios
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);

CREATE TABLE IF NOT EXISTS portfolio_assets (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol        VARCHAR(50) NOT NULL,
  name          VARCHAR(200),
  asset_type    asset_type NOT NULL DEFAULT 'equity',
  sector        VARCHAR(100),
  quantity      NUMERIC(20,6) NOT NULL DEFAULT 0,
  avg_price     NUMERIC(18,4) NOT NULL DEFAULT 0,
  current_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  cost_value    NUMERIC(18,2) NOT NULL DEFAULT 0,
  market_value  NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, symbol)
);
CREATE INDEX IF NOT EXISTS idx_portfolio_assets_portfolio ON portfolio_assets(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_assets_symbol ON portfolio_assets(symbol);

CREATE TABLE IF NOT EXISTS trades_real (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol        VARCHAR(50) NOT NULL,
  side          trade_side NOT NULL,
  quantity      NUMERIC(20,6) NOT NULL CHECK (quantity > 0),
  price         NUMERIC(18,4) NOT NULL CHECK (price >= 0),
  fees          NUMERIC(18,2) NOT NULL DEFAULT 0,
  traded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        VARCHAR(30) NOT NULL DEFAULT 'broker'
);
CREATE INDEX IF NOT EXISTS idx_trades_real_portfolio ON trades_real(portfolio_id, traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_real_symbol ON trades_real(symbol);

CREATE TABLE IF NOT EXISTS portfolio_snapshots_daily (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  day           DATE NOT NULL,
  total_value   NUMERIC(18,2) NOT NULL,
  risk_score    NUMERIC(5,2) NOT NULL,
  diversification_score NUMERIC(6,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, day)
);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_day ON portfolio_snapshots_daily(day);

CREATE TABLE IF NOT EXISTS portfolio_ai_analysis (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  analysis_kind VARCHAR(50) NOT NULL, -- risk_score, rebalance, tax, etc.
  input_snapshot JSONB NOT NULL,
  output_result  JSONB NOT NULL,
  risk_level     risk_level,
  confidence_score NUMERIC(5,2),
  model_version  VARCHAR(80),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_ai_analysis_portfolio ON portfolio_ai_analysis(portfolio_id, created_at DESC);

-- =========================
-- 6) Virtual Investment Lab
-- =========================

CREATE TABLE IF NOT EXISTS virtual_wallets (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  currency    VARCHAR(10) NOT NULL DEFAULT 'INR',
  balance     NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_virtual_wallets_updated_at ON virtual_wallets;
CREATE TRIGGER trg_virtual_wallets_updated_at
BEFORE UPDATE ON virtual_wallets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS trades_virtual (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id   BIGINT NOT NULL REFERENCES virtual_wallets(id) ON DELETE CASCADE,
  symbol      VARCHAR(50) NOT NULL,
  side        trade_side NOT NULL,
  quantity    NUMERIC(20,6) NOT NULL CHECK (quantity > 0),
  price       NUMERIC(18,4) NOT NULL CHECK (price >= 0),
  traded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trades_virtual_wallet ON trades_virtual(wallet_id, traded_at DESC);

CREATE TABLE IF NOT EXISTS leaderboard_periods (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         VARCHAR(50) NOT NULL UNIQUE, -- daily:2026-03-27, monthly:2026-03, all_time
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  period_id   BIGINT NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roi_pct     NUMERIC(9,4) NOT NULL DEFAULT 0,
  rank_pos    INT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (period_id, user_id),
  UNIQUE (period_id, rank_pos)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_rank ON leaderboard_entries(period_id, rank_pos);

-- =========================
-- 7) Personal Finance / UPI
-- =========================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name       VARCHAR(150) NOT NULL,
  account_masked  VARCHAR(50),
  aa_token_enc    TEXT,
  provider        VARCHAR(100),
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_bank_accounts_updated_at ON bank_accounts;
CREATE TRIGGER trg_bank_accounts_updated_at
BEFORE UPDATE ON bank_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON bank_accounts(user_id);

CREATE TABLE IF NOT EXISTS expense_categories (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  parent_name   VARCHAR(100),
  is_system     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  external_ref    VARCHAR(120),
  amount          NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  txn_type        txn_type NOT NULL,
  merchant_name   VARCHAR(150),
  description     TEXT,
  category_id     BIGINT REFERENCES expense_categories(id) ON DELETE SET NULL,
  categorized_by  VARCHAR(20) NOT NULL DEFAULT 'ai', -- ai/manual/rule
  occurred_at     TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_ref)
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_time ON transactions(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_time ON transactions(category_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS budgets (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id   BIGINT REFERENCES expense_categories(id) ON DELETE SET NULL,
  month_key     VARCHAR(7) NOT NULL, -- YYYY-MM
  monthly_limit NUMERIC(18,2) NOT NULL CHECK (monthly_limit >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month_key)
);
DROP TRIGGER IF EXISTS trg_budgets_updated_at ON budgets;
CREATE TRIGGER trg_budgets_updated_at
BEFORE UPDATE ON budgets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month_key);

CREATE TABLE IF NOT EXISTS savings_goals (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  target_amount NUMERIC(18,2) NOT NULL CHECK (target_amount >= 0),
  current_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS trg_savings_goals_updated_at ON savings_goals;
CREATE TRIGGER trg_savings_goals_updated_at
BEFORE UPDATE ON savings_goals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS financial_scores (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score         INT NOT NULL CHECK (score >= 0 AND score <= 100),
  calculation_date DATE NOT NULL,
  input_snapshot JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, calculation_date)
);

-- =========================
-- 8) AI + Compliance logging
-- =========================

CREATE TABLE IF NOT EXISTS ai_logs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  module        VARCHAR(100) NOT NULL,
  input_data    JSONB,
  output_data   JSONB,
  confidence_score NUMERIC(5,2),
  model_version VARCHAR(80),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_module_time ON ai_logs(module, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_decision_logs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  agent_type      VARCHAR(80) NOT NULL,
  input_data_hash TEXT,
  output_summary  TEXT,
  risk_flag       BOOLEAN NOT NULL DEFAULT false,
  confidence_score NUMERIC(5,2),
  model_version   VARCHAR(80),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_agent_time ON ai_decision_logs(agent_type, created_at DESC);

CREATE TABLE IF NOT EXISTS compliance_logs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  module          VARCHAR(100) NOT NULL, -- market_post, comment, community, dm, payment, etc.
  reference_id    BIGINT,
  status          compliance_status NOT NULL,
  risk_score      NUMERIC(5,2),
  notes           TEXT,
  created_by      VARCHAR(30) NOT NULL DEFAULT 'ai', -- ai/admin/system
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_logs_module_ref ON compliance_logs(module, reference_id);

-- =========================
-- 9) Courses, subscriptions, payments, payouts
-- =========================

CREATE TABLE IF NOT EXISTS courses (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  advisor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency      VARCHAR(10) NOT NULL DEFAULT 'INR',
  cover_image_url TEXT,
  is_published  BOOLEAN NOT NULL DEFAULT false,
  compliance_status compliance_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_courses_advisor ON courses(advisor_user_id);

CREATE TABLE IF NOT EXISTS course_lessons (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id   BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  position    INT NOT NULL,
  video_url   TEXT,
  duration_seconds INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, position)
);
CREATE INDEX IF NOT EXISTS idx_course_lessons_course ON course_lessons(course_id, position);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id   BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON course_enrollments(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  advisor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency      VARCHAR(10) NOT NULL DEFAULT 'INR',
  status        subscription_status NOT NULL DEFAULT 'pending',
  start_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date      TIMESTAMPTZ,
  provider      VARCHAR(50), -- razorpay/stripe/etc
  provider_subscription_id VARCHAR(120),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, advisor_user_id)
);
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_subscriptions_advisor ON subscriptions(advisor_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS payments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  kind          VARCHAR(40) NOT NULL, -- subscription, course, payout, refund
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency      VARCHAR(10) NOT NULL DEFAULT 'INR',
  status        payment_status NOT NULL DEFAULT 'created',
  provider      VARCHAR(50),
  provider_payment_id VARCHAR(120),
  reference_kind VARCHAR(40), -- subscription/course_enrollment/etc
  reference_id  BIGINT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_status_time ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(reference_kind, reference_id);

CREATE TABLE IF NOT EXISTS advisor_wallets (
  advisor_user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance         NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  advisor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status        payout_status NOT NULL DEFAULT 'requested',
  destination   JSONB, -- bank/upi details (store tokenized reference, not raw)
  reviewed_by_admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_payout_requests_updated_at ON payout_requests;
CREATE TRIGGER trg_payout_requests_updated_at
BEFORE UPDATE ON payout_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

-- =========================
-- 10) Notifications + Audit logs (Admin)
-- =========================

CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     notification_channel NOT NULL DEFAULT 'in_app',
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  data        JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_time ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(120) NOT NULL,
  module      VARCHAR(80) NOT NULL,
  target_kind VARCHAR(50),
  target_id   BIGINT,
  payload     JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_time ON audit_logs(module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_kind, target_id);

COMMIT;

