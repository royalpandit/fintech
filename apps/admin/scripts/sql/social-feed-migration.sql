-- Social feed composer — extend community posts with media, symbols, articles

DO $$ BEGIN
  CREATE TYPE feed_post_type AS ENUM ('text', 'image', 'video', 'chart', 'article', 'idea');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS post_type feed_post_type NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS sentiment sentiment_type,
  ADD COLUMN IF NOT EXISTS target_price DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS stop_loss_price DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS article_body TEXT;

CREATE INDEX IF NOT EXISTS community_posts_post_type_idx ON community_posts(post_type);

CREATE TABLE IF NOT EXISTS community_post_images (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS community_post_images_post_id_idx ON community_post_images(post_id);

CREATE TABLE IF NOT EXISTS community_post_videos (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS community_post_videos_post_id_idx ON community_post_videos(post_id);

CREATE TABLE IF NOT EXISTS community_post_symbols (
  id              BIGSERIAL PRIMARY KEY,
  post_id         BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  symbol          VARCHAR(50) NOT NULL,
  trading_symbol  VARCHAR(80),
  exchange        VARCHAR(16),
  token           VARCHAR(32),
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS community_post_symbols_post_id_idx ON community_post_symbols(post_id);
CREATE INDEX IF NOT EXISTS community_post_symbols_symbol_idx ON community_post_symbols(symbol);

CREATE TABLE IF NOT EXISTS community_reactions (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       reaction_type NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id, type)
);
CREATE INDEX IF NOT EXISTS community_reactions_post_id_idx ON community_reactions(post_id);

-- Ensure app role (flexi) can read/write social tables
DO $$ BEGIN ALTER TABLE community_post_images OWNER TO flexi; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE community_post_videos OWNER TO flexi; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE community_post_symbols OWNER TO flexi; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE community_reactions OWNER TO flexi; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Guarded so this is a no-op on managed DBs (e.g. Prisma Postgres) where the
-- 'flexi' role doesn't exist and GRANT/REVOKE is not permitted.
DO $$ BEGIN
  GRANT ALL ON community_post_images, community_post_videos, community_post_symbols, community_reactions TO flexi;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO flexi;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
