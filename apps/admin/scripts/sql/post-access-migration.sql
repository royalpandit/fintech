CREATE TYPE post_access_type AS ENUM ('free', 'paid');
CREATE TYPE post_payment_status AS ENUM ('none', 'pending', 'completed', 'failed', 'dev_bypass');

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS post_access_type post_access_type NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS unlock_price DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS payment_status post_payment_status NOT NULL DEFAULT 'none';

ALTER TABLE market_posts
  ADD COLUMN IF NOT EXISTS post_access_type post_access_type NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS unlock_price DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS payment_status post_payment_status NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS community_posts_access_idx ON community_posts (post_access_type);
CREATE INDEX IF NOT EXISTS market_posts_access_idx ON market_posts (post_access_type);

CREATE TABLE IF NOT EXISTS community_post_unlocks (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_status post_payment_status NOT NULL DEFAULT 'dev_bypass',
  unlock_price DECIMAL(12, 2),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_post_unlocks_user_idx ON community_post_unlocks (user_id);

CREATE TABLE IF NOT EXISTS market_post_unlocks (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES market_posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_status post_payment_status NOT NULL DEFAULT 'dev_bypass',
  unlock_price DECIMAL(12, 2),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS market_post_unlocks_user_idx ON market_post_unlocks (user_id);
