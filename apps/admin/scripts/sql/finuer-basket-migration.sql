-- Finuer Basket module migration (idempotent)

DO $$ BEGIN
  CREATE TYPE finuer_catalog_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finuer_basket_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finuer_basket_visibility AS ENUM ('public', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finuer_rebalance_frequency AS ENUM ('weekly', 'monthly', 'quarterly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finuer_basket_required_plan AS ENUM ('free', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finuer_performance_status AS ENUM ('outperforming', 'underperforming');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS finuer_markets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  status finuer_catalog_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finuer_basket_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  status finuer_catalog_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finuer_benchmarks (
  id SERIAL PRIMARY KEY,
  market_id INT NOT NULL REFERENCES finuer_markets(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (market_id, name)
);

CREATE TABLE IF NOT EXISTS finuer_baskets (
  id SERIAL PRIMARY KEY,
  basket_name VARCHAR(160) NOT NULL,
  short_description TEXT,
  market_id INT NOT NULL REFERENCES finuer_markets(id) ON DELETE RESTRICT,
  type_id INT NOT NULL REFERENCES finuer_basket_types(id) ON DELETE RESTRICT,
  benchmark_id INT NOT NULL REFERENCES finuer_benchmarks(id) ON DELETE RESTRICT,
  status finuer_basket_status NOT NULL DEFAULT 'active',
  visibility finuer_basket_visibility NOT NULL DEFAULT 'public',
  rebalance_frequency finuer_rebalance_frequency NOT NULL DEFAULT 'monthly',
  required_plan finuer_basket_required_plan NOT NULL DEFAULT 'free',
  created_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finuer_basket_performance (
  id SERIAL PRIMARY KEY,
  basket_id INT NOT NULL UNIQUE REFERENCES finuer_baskets(id) ON DELETE CASCADE,
  one_month_return DECIMAL(9,4),
  six_month_return DECIMAL(9,4),
  one_year_return DECIMAL(9,4),
  three_year_return DECIMAL(9,4),
  five_year_return DECIMAL(9,4),
  since_launch_return DECIMAL(9,4),
  benchmark_one_month DECIMAL(9,4),
  benchmark_three_month DECIMAL(9,4),
  benchmark_six_month DECIMAL(9,4),
  benchmark_one_year DECIMAL(9,4),
  benchmark_three_year DECIMAL(9,4),
  benchmark_five_year DECIMAL(9,4),
  benchmark_since_launch DECIMAL(9,4),
  performance_status finuer_performance_status NOT NULL DEFAULT 'underperforming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finuer_baskets_status_visibility ON finuer_baskets(status, visibility);
CREATE INDEX IF NOT EXISTS idx_finuer_baskets_market ON finuer_baskets(market_id);
CREATE INDEX IF NOT EXISTS idx_finuer_baskets_type ON finuer_baskets(type_id);
