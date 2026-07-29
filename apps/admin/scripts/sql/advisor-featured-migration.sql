-- Paid advisor promotion ("Featured Analyst"). Idempotent.
ALTER TABLE advisor_profiles
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS featured_tier VARCHAR(20);

CREATE INDEX IF NOT EXISTS advisor_profiles_featured_until_idx
  ON advisor_profiles (featured_until);
