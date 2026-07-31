-- Extend professional types to the full 10 + admin-editable capability matrix.
ALTER TYPE professional_type ADD VALUE IF NOT EXISTS 'mutual_fund_distributor';
ALTER TYPE professional_type ADD VALUE IF NOT EXISTS 'stock_broker';
ALTER TYPE professional_type ADD VALUE IF NOT EXISTS 'finance_creator';
ALTER TYPE professional_type ADD VALUE IF NOT EXISTS 'listed_company';
ALTER TYPE professional_type ADD VALUE IF NOT EXISTS 'financial_platform';

CREATE TABLE IF NOT EXISTS professional_capabilities (
  id SERIAL PRIMARY KEY,
  professional_type professional_type NOT NULL,
  capability VARCHAR(64) NOT NULL,
  allowed BOOLEAN NOT NULL,
  updated_by_admin_id INTEGER,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS professional_capabilities_type_cap_key
  ON professional_capabilities (professional_type, capability);
