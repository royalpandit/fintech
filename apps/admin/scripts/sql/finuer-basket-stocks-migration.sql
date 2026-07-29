-- Finuer Basket stocks + 3-month return column

ALTER TABLE finuer_basket_performance
  ADD COLUMN IF NOT EXISTS three_month_return DECIMAL(9,4);

CREATE TABLE IF NOT EXISTS finuer_basket_stocks (
  id SERIAL PRIMARY KEY,
  basket_id INT NOT NULL REFERENCES finuer_baskets(id) ON DELETE CASCADE,
  symbol VARCHAR(30) NOT NULL,
  stock_name VARCHAR(120) NOT NULL,
  exchange VARCHAR(10) NOT NULL DEFAULT 'NSE',
  weight_pct DECIMAL(6,2),
  cmp DECIMAL(18,4),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_finuer_basket_stocks_basket ON finuer_basket_stocks(basket_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_finuer_basket_stocks_deleted ON finuer_basket_stocks(basket_id, deleted_at);
