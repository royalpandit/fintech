-- Trades Phase 1 + 2
-- Turns advisor market posts into "trades" with a lifecycle: entry range,
-- exchange, structured timeframe, status, conviction, a timeline of updates and
-- chart images.
--
-- Idempotent + guarded for the managed Prisma Postgres (see db-migration-workflow).
-- REVERT: see scripts/sql/trades-phase1-2-rollback.sql

-- ── enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE trade_status AS ENUM (
    'awaiting_entry', 'active', 'target_hit', 'sl_hit', 'closed'
  );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trade_timeframe AS ENUM (
    'intraday', 'short_term', 'medium_term', 'long_term'
  );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trade_update_kind AS ENUM (
    'published', 'entry_triggered', 'sl_moved', 'target_hit', 'sl_hit', 'closed', 'note'
  );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── market_posts columns ─────────────────────────────────────────────────
ALTER TABLE market_posts
  ADD COLUMN IF NOT EXISTS timeframe_type  trade_timeframe,
  ADD COLUMN IF NOT EXISTS exchange        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS entry_price_min DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS entry_price_max DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS trade_status    trade_status NOT NULL DEFAULT 'awaiting_entry',
  ADD COLUMN IF NOT EXISTS conviction      INTEGER;

CREATE INDEX IF NOT EXISTS market_posts_trade_status_idx ON market_posts (trade_status);

-- ── trade timeline ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_post_updates (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES market_posts (id) ON DELETE CASCADE,
  kind       trade_update_kind NOT NULL DEFAULT 'note',
  title      VARCHAR(120) NOT NULL,
  note       TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS market_post_updates_post_created_idx
  ON market_post_updates (post_id, created_at);

-- ── chart images ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_post_images (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES market_posts (id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS market_post_images_post_idx ON market_post_images (post_id);
