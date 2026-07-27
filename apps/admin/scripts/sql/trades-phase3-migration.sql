-- Trades Phase 3
-- Completes the trade lifecycle: draft/cancelled/exited statuses, more asset
-- classes, entry type, and manual exit fields (price / reason / return %).
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so these
-- run as standalone idempotent statements (IF NOT EXISTS, PG 12+).
-- REVERT: enum values can't be dropped in Postgres; see rollback for columns.

-- ── new trade statuses ──
ALTER TYPE trade_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE trade_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE trade_status ADD VALUE IF NOT EXISTS 'exited';

-- ── new asset classes ──
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'futures';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'options';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'currency';

-- ── new timeline update kinds ──
ALTER TYPE trade_update_kind ADD VALUE IF NOT EXISTS 'partial_booked';
ALTER TYPE trade_update_kind ADD VALUE IF NOT EXISTS 'exited';
ALTER TYPE trade_update_kind ADD VALUE IF NOT EXISTS 'cancelled';

-- ── entry-type enum ──
DO $$ BEGIN
  CREATE TYPE trade_entry_type AS ENUM ('market', 'exact', 'range');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── new columns ──
ALTER TABLE market_posts
  ADD COLUMN IF NOT EXISTS entry_type      trade_entry_type,
  ADD COLUMN IF NOT EXISTS exit_price      DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS exit_reason     TEXT,
  ADD COLUMN IF NOT EXISTS exit_return_pct DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS closed_at       TIMESTAMP(3);
