-- Fix social feed DB: missing community_reactions + table permissions for flexi role

CREATE TABLE IF NOT EXISTS community_reactions (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       reaction_type NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS community_reactions_post_id_idx ON community_reactions(post_id);

-- Tables created by migration may be owned by OS user; app connects as flexi
DO $$ BEGIN
  ALTER TABLE community_reactions OWNER TO flexi;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE community_post_images OWNER TO flexi;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE community_post_videos OWNER TO flexi;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE community_post_symbols OWNER TO flexi;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

GRANT ALL ON community_reactions TO flexi;
GRANT ALL ON community_post_images TO flexi;
GRANT ALL ON community_post_videos TO flexi;
GRANT ALL ON community_post_symbols TO flexi;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO flexi;
