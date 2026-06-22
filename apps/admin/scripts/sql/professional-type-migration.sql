-- Adds a structured professional type to advisor profiles so users can search
-- finance professionals by role (analyst, portfolio manager, advisory firm, etc.).
-- Idempotent + guarded for the managed Prisma Postgres (see db-migration-workflow).

DO $$ BEGIN
  CREATE TYPE professional_type AS ENUM (
    'investment_advisor',
    'research_analyst',
    'portfolio_manager',
    'advisory_firm',
    'wealth_manager'
  );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE advisor_profiles
  ADD COLUMN IF NOT EXISTS professional_type professional_type NOT NULL DEFAULT 'investment_advisor';
