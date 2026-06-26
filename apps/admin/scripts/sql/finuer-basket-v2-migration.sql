-- Finuer Basket v2: methodology, auto-performance support, rebalance history

ALTER TABLE finuer_baskets
  ADD COLUMN IF NOT EXISTS methodology TEXT,
  ADD COLUMN IF NOT EXISTS last_rebalanced_at TIMESTAMPTZ;

ALTER TABLE finuer_benchmarks
  ADD COLUMN IF NOT EXISTS symbol VARCHAR(30),
  ADD COLUMN IF NOT EXISTS exchange VARCHAR(10) DEFAULT 'NSE';

ALTER TABLE finuer_basket_stocks
  ADD COLUMN IF NOT EXISTS entry_price NUMERIC(18, 4);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finuer_rebalance_action') THEN
    CREATE TYPE finuer_rebalance_action AS ENUM ('add', 'remove', 'increase_weight', 'decrease_weight');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS finuer_basket_rebalance_events (
  id SERIAL PRIMARY KEY,
  basket_id INT NOT NULL REFERENCES finuer_baskets(id) ON DELETE CASCADE,
  action finuer_rebalance_action NOT NULL,
  symbol VARCHAR(30) NOT NULL,
  stock_name VARCHAR(120),
  old_weight NUMERIC(6, 2),
  new_weight NUMERIC(6, 2),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS finuer_basket_rebalance_events_basket_id_created_at_idx
  ON finuer_basket_rebalance_events(basket_id, created_at);

-- Backfill entry price from CMP where missing
UPDATE finuer_basket_stocks
SET entry_price = cmp
WHERE entry_price IS NULL AND cmp IS NOT NULL;
