-- Competition module tables (idempotent)

DO $$ BEGIN
  CREATE TYPE competition_status AS ENUM ('upcoming', 'live', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE competition_visibility AS ENUM ('public', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE competition_entry_type AS ENUM ('free', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE competition_role_key AS ENUM ('user', 'advisor', 'creator', 'analyst', 'all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE competition_reward_type AS ENUM ('cash', 'coin', 'premium_subscription', 'coupon');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE competition_participant_status AS ENUM ('active', 'disqualified', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS competitions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  short_description VARCHAR(500),
  description TEXT,
  banner_image VARCHAR(500),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status competition_status NOT NULL DEFAULT 'upcoming',
  visibility competition_visibility NOT NULL DEFAULT 'public',
  entry_type competition_entry_type NOT NULL DEFAULT 'free',
  entry_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  prize_pool DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_winners INT NOT NULL DEFAULT 0,
  max_participants INT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitions_status_visibility ON competitions(status, visibility);
CREATE INDEX IF NOT EXISTS idx_competitions_dates ON competitions(start_date, end_date);

CREATE TABLE IF NOT EXISTS competition_roles (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  role_key competition_role_key NOT NULL,
  UNIQUE (competition_id, role_key)
);

CREATE INDEX IF NOT EXISTS idx_competition_roles_competition ON competition_roles(competition_id);

CREATE TABLE IF NOT EXISTS competition_participants (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key competition_role_key NOT NULL,
  status competition_participant_status NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_participants_competition ON competition_participants(competition_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_competition_participants_user ON competition_participants(user_id);

CREATE TABLE IF NOT EXISTS competition_leaderboard (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points DECIMAL(12, 2) NOT NULL DEFAULT 0,
  score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  rank INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_leaderboard_rank ON competition_leaderboard(competition_id, rank);
CREATE INDEX IF NOT EXISTS idx_competition_leaderboard_points ON competition_leaderboard(competition_id, points);

CREATE TABLE IF NOT EXISTS competition_prizes (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  from_rank INT NOT NULL,
  to_rank INT NOT NULL,
  reward_type competition_reward_type NOT NULL,
  reward_value VARCHAR(200) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_competition_prizes_competition ON competition_prizes(competition_id, from_rank);

CREATE TABLE IF NOT EXISTS competition_winners (
  id SERIAL PRIMARY KEY,
  competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INT NOT NULL,
  reward_type competition_reward_type NOT NULL,
  reward_value VARCHAR(200) NOT NULL,
  distributed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (competition_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_competition_winners_competition ON competition_winners(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_winners_user ON competition_winners(user_id);
