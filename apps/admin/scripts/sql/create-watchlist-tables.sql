-- Safe additive migration: watchlist tables only (matches existing bigint user ids)

CREATE TABLE IF NOT EXISTS watchlists (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL DEFAULT 'Default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS watchlists_user_id_idx ON watchlists(user_id);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id           BIGSERIAL PRIMARY KEY,
  watchlist_id BIGINT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol       VARCHAR(50) NOT NULL,
  asset_type   asset_type NOT NULL DEFAULT 'equity',
  notes        TEXT,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT watchlist_items_watchlist_id_symbol_key UNIQUE (watchlist_id, symbol)
);

CREATE INDEX IF NOT EXISTS watchlist_items_symbol_idx ON watchlist_items(symbol);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_watchlists_updated_at') THEN
      CREATE TRIGGER trg_watchlists_updated_at
        BEFORE UPDATE ON watchlists
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
  END IF;
END $$;
