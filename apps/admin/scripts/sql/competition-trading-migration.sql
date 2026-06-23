-- Competition trading tables (portfolios, holdings, orders) + leaderboard columns

DO $$ BEGIN
  CREATE TYPE competition_transaction_type AS ENUM ('buy', 'sell');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE competition_leaderboard
  ADD COLUMN IF NOT EXISTS portfolio_value DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_return DECIMAL(8, 4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS competition_portfolios (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initial_capital DECIMAL(14, 2) NOT NULL,
  cash_balance DECIMAL(14, 2) NOT NULL,
  invested_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  portfolio_value DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_return DECIMAL(8, 4) NOT NULL DEFAULT 0,
  today_return DECIMAL(8, 4) NOT NULL DEFAULT 0,
  rank INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_portfolios_return ON competition_portfolios(competition_id, total_return);

CREATE TABLE IF NOT EXISTS competition_holdings (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stock_symbol VARCHAR(30) NOT NULL,
  company_name VARCHAR(120) NOT NULL,
  exchange VARCHAR(10) NOT NULL DEFAULT 'NSE',
  symbol_token VARCHAR(32),
  quantity INT NOT NULL,
  avg_buy_price DECIMAL(18, 4) NOT NULL,
  current_price DECIMAL(18, 4) NOT NULL,
  invested_amount DECIMAL(14, 2) NOT NULL,
  market_value DECIMAL(14, 2) NOT NULL,
  pnl DECIMAL(14, 2) NOT NULL DEFAULT 0,
  pnl_percentage DECIMAL(8, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, user_id, stock_symbol)
);

CREATE INDEX IF NOT EXISTS idx_competition_holdings_user ON competition_holdings(competition_id, user_id);

CREATE TABLE IF NOT EXISTS competition_orders (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stock_symbol VARCHAR(30) NOT NULL,
  company_name VARCHAR(120) NOT NULL,
  transaction_type competition_transaction_type NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(18, 4) NOT NULL,
  total_amount DECIMAL(14, 2) NOT NULL,
  order_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competition_orders_user_time ON competition_orders(competition_id, user_id, order_time);

-- Backfill portfolios for existing participants
INSERT INTO competition_portfolios (
  competition_id, user_id, initial_capital, cash_balance, portfolio_value
)
SELECT cp.competition_id, cp.user_id, 1000000, 1000000, 1000000
FROM competition_participants cp
WHERE cp.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM competition_portfolios p
    WHERE p.competition_id = cp.competition_id AND p.user_id = cp.user_id
  );

-- Sync leaderboard portfolio columns from portfolios
UPDATE competition_leaderboard lb
SET
  portfolio_value = COALESCE(p.portfolio_value, 1000000),
  total_return = COALESCE(p.total_return, 0),
  points = COALESCE(p.portfolio_value, 1000000),
  score = COALESCE(p.total_return, 0)
FROM competition_portfolios p
WHERE lb.competition_id = p.competition_id AND lb.user_id = p.user_id;
