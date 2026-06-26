-- Prediction competition engine migration

ALTER TYPE competition_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'upcoming';
ALTER TYPE competition_visibility ADD VALUE IF NOT EXISTS 'pro_members';
ALTER TYPE competition_visibility ADD VALUE IF NOT EXISTS 'financial_professionals';

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS participation_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS participation_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reputation_points INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS wrong_prediction_points INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_predictions_per_user INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allow_prediction_change BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_login BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS winning_option_id INT,
  ADD COLUMN IF NOT EXISTS result_declared_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS competition_options (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  label VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS competition_options_competition_id_sort_order_idx
  ON competition_options(competition_id, sort_order);

CREATE TABLE IF NOT EXISTS competition_predictions (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id INT NOT NULL REFERENCES competition_options(id) ON DELETE CASCADE,
  is_correct BOOLEAN,
  points_earned INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

CREATE INDEX IF NOT EXISTS competition_predictions_competition_id_option_id_idx
  ON competition_predictions(competition_id, option_id);
CREATE INDEX IF NOT EXISTS competition_predictions_user_id_submitted_at_idx
  ON competition_predictions(user_id, submitted_at);

CREATE TABLE IF NOT EXISTS user_prediction_stats (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  finuer_score INT NOT NULL DEFAULT 0,
  competitions_participated INT NOT NULL DEFAULT 0,
  competitions_won INT NOT NULL DEFAULT 0,
  competitions_lost INT NOT NULL DEFAULT 0,
  current_winning_streak INT NOT NULL DEFAULT 0,
  best_winning_streak INT NOT NULL DEFAULT 0,
  last_competition_played_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'competitions_winning_option_id_fkey'
  ) THEN
    ALTER TABLE competitions
      ADD CONSTRAINT competitions_winning_option_id_fkey
      FOREIGN KEY (winning_option_id) REFERENCES competition_options(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS competitions_participation_dates_idx
  ON competitions(participation_start_date, participation_end_date);
