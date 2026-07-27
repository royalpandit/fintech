-- ROLLBACK for trades-phase1-2-migration.sql
--
-- WARNING: destructive. Dropping the columns/tables permanently deletes every
-- trade timeline entry, chart image, entry range, exchange, status and
-- conviction value. Take a backup first if any real trades exist.
--
-- Run only if Phase 1/2 is being reverted:
--   npx prisma db execute --file scripts/sql/trades-phase1-2-rollback.sql

DROP TABLE IF EXISTS market_post_images;
DROP TABLE IF EXISTS market_post_updates;

DROP INDEX IF EXISTS market_posts_trade_status_idx;

ALTER TABLE market_posts
  DROP COLUMN IF EXISTS timeframe_type,
  DROP COLUMN IF EXISTS exchange,
  DROP COLUMN IF EXISTS entry_price_min,
  DROP COLUMN IF EXISTS entry_price_max,
  DROP COLUMN IF EXISTS trade_status,
  DROP COLUMN IF EXISTS conviction;

DO $$ BEGIN DROP TYPE IF EXISTS trade_update_kind; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS trade_timeframe;   EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS trade_status;      EXCEPTION WHEN OTHERS THEN NULL; END $$;
