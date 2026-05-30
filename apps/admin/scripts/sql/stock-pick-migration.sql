-- AI Stock Picks module
CREATE TYPE stock_pick_recommendation AS ENUM (
  'strong_buy', 'buy', 'hold', 'sell', 'strong_sell'
);

CREATE TABLE IF NOT EXISTS stock_pick_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(80),
  icon_emoji VARCHAR(10) NOT NULL DEFAULT '📈',
  performance_pct DECIMAL(9, 4),
  benchmark_pct DECIMAL(9, 4),
  chart_data JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stock_pick_groups_published_idx
  ON stock_pick_groups (is_published, sort_order);
CREATE INDEX IF NOT EXISTS stock_pick_groups_deleted_idx
  ON stock_pick_groups (deleted_at);

CREATE TABLE IF NOT EXISTS stock_pick_stocks (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES stock_pick_groups(id) ON DELETE CASCADE,
  symbol VARCHAR(30) NOT NULL,
  stock_name VARCHAR(120) NOT NULL,
  cmp DECIMAL(18, 4),
  target_price DECIMAL(18, 4),
  stop_loss DECIMAL(18, 4),
  recommendation stock_pick_recommendation NOT NULL DEFAULT 'buy',
  analyst_note TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stock_pick_stocks_group_sort_idx
  ON stock_pick_stocks (group_id, sort_order);
CREATE INDEX IF NOT EXISTS stock_pick_stocks_group_published_idx
  ON stock_pick_stocks (group_id, is_published);
