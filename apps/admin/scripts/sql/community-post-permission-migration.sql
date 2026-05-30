-- Post permission setting for communities

DO $$ BEGIN
  CREATE TYPE post_permission AS ENUM ('everyone', 'admins', 'owner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS post_permission post_permission NOT NULL DEFAULT 'everyone';
