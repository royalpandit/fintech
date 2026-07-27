-- ROLLBACK for trades-phase3-migration.sql
--
-- WARNING: destructive for the new columns. Postgres CANNOT drop individual enum
-- values, so 'draft'/'cancelled'/'exited' etc. will remain on the enum types
-- (harmless). Only the columns and the entry-type enum are removed here.

ALTER TABLE market_posts
  DROP COLUMN IF EXISTS entry_type,
  DROP COLUMN IF EXISTS exit_price,
  DROP COLUMN IF EXISTS exit_reason,
  DROP COLUMN IF EXISTS exit_return_pct,
  DROP COLUMN IF EXISTS closed_at;

DO $$ BEGIN DROP TYPE IF EXISTS trade_entry_type; EXCEPTION WHEN OTHERS THEN NULL; END $$;
