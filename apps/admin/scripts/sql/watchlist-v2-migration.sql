-- Watchlist v2: tabs, instrument metadata, sort order (run once on existing DBs)

ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS watchlists_user_id_sort_order_idx ON watchlists(user_id, sort_order);

ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS instrument_key VARCHAR(80);
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS display_name VARCHAR(120);
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS trading_symbol VARCHAR(80);
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS token VARCHAR(32);
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS exchange VARCHAR(16);
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS instrument_type VARCHAR(16);
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

UPDATE watchlist_items
SET instrument_key = COALESCE(instrument_key, symbol)
WHERE instrument_key IS NULL OR instrument_key = '';

ALTER TABLE watchlist_items ALTER COLUMN instrument_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS watchlist_items_watchlist_id_sort_order_idx ON watchlist_items(watchlist_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'watchlist_items_watchlist_id_instrument_key_key'
  ) THEN
    ALTER TABLE watchlist_items DROP CONSTRAINT IF EXISTS watchlist_items_watchlist_id_symbol_key;
    ALTER TABLE watchlist_items ADD CONSTRAINT watchlist_items_watchlist_id_instrument_key_key
      UNIQUE (watchlist_id, instrument_key);
  END IF;
END $$;
