-- Analyst Messages — Broadcast (1-to-many).
-- A broadcast is fanned out into each subscriber's private chat as DmMessages
-- tagged with broadcast_id. Idempotent (see db-migration-workflow).
-- REVERT: scripts/sql/dm-broadcasts-rollback.sql

CREATE TABLE IF NOT EXISTS dm_broadcasts (
  id              SERIAL PRIMARY KEY,
  analyst_user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  attachment_url  TEXT,
  attachment_type VARCHAR(20),
  attachment_name TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at    TIMESTAMP(3),
  sent_at         TIMESTAMP(3),
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dm_broadcasts_analyst_created_idx ON dm_broadcasts (analyst_user_id, created_at);
CREATE INDEX IF NOT EXISTS dm_broadcasts_scheduled_idx ON dm_broadcasts (scheduled_at);

ALTER TABLE dm_messages
  ADD COLUMN IF NOT EXISTS broadcast_id INTEGER REFERENCES dm_broadcasts (id) ON DELETE SET NULL;
