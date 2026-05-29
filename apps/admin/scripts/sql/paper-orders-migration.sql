-- Paper orders (broker-style order book) — run once on existing DBs

DO $$ BEGIN
  CREATE TYPE paper_order_type AS ENUM ('MARKET', 'LIMIT', 'SL', 'SL_M');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE paper_order_status AS ENUM ('OPEN', 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS paper_orders (
  id              BIGSERIAL PRIMARY KEY,
  wallet_id       BIGINT NOT NULL REFERENCES virtual_wallets(id) ON DELETE CASCADE,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol          VARCHAR(50) NOT NULL,
  trading_symbol  VARCHAR(80),
  token           VARCHAR(32),
  exchange        VARCHAR(16),
  side            trade_side NOT NULL,
  order_type      paper_order_type NOT NULL,
  product         VARCHAR(16) NOT NULL DEFAULT 'CNC',
  quantity        DECIMAL(20, 6) NOT NULL,
  limit_price     DECIMAL(18, 4),
  trigger_price   DECIMAL(18, 4),
  execution_price DECIMAL(18, 4),
  status          paper_order_status NOT NULL DEFAULT 'PENDING',
  reject_reason   VARCHAR(255),
  trade_id        BIGINT UNIQUE REFERENCES trades_virtual(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS paper_orders_wallet_id_status_idx ON paper_orders(wallet_id, status);
CREATE INDEX IF NOT EXISTS paper_orders_user_id_status_created_at_idx ON paper_orders(user_id, status, created_at DESC);
