-- Community module migration (extends groups → Reddit-style communities)

DO $$ BEGIN
  CREATE TYPE community_type AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE join_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE feed_post_type ADD VALUE IF NOT EXISTS 'link';

ALTER TABLE groups ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE groups ADD COLUMN IF NOT EXISTS slug VARCHAR(150);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS community_type community_type NOT NULL DEFAULT 'public';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS rules TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE groups SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;
UPDATE groups SET uuid = gen_random_uuid() WHERE uuid IS NULL;

ALTER TABLE groups ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS groups_slug_key ON groups(slug);
CREATE UNIQUE INDEX IF NOT EXISTS groups_uuid_key ON groups(uuid);

ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS community_posts_group_id_idx ON community_posts(group_id);
CREATE INDEX IF NOT EXISTS community_posts_pinned_at_idx ON community_posts(pinned_at DESC);

CREATE TABLE IF NOT EXISTS group_join_requests (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status join_request_status NOT NULL DEFAULT 'pending',
  message TEXT,
  reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS group_join_requests_group_status_idx ON group_join_requests(group_id, status);

CREATE TABLE IF NOT EXISTS group_bans (
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_post_shares (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS community_post_shares_post_id_idx ON community_post_shares(post_id);
