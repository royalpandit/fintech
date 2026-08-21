-- Idempotent store for NSE FII/DII, bulk deals, and the daily ETF extract.
CREATE TABLE IF NOT EXISTS market_feed_snapshots (
  kind       VARCHAR(40) PRIMARY KEY,
  payload    JSONB NOT NULL,
  fetched_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
