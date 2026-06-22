-- Adds media/document attachments to direct messages so users and advisors can
-- send images and files in chat. Idempotent (see db-migration-workflow).

ALTER TABLE dm_messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;
