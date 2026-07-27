-- ROLLBACK for dm-broadcasts-migration.sql (destructive).
ALTER TABLE dm_messages DROP COLUMN IF EXISTS broadcast_id;
DROP TABLE IF EXISTS dm_broadcasts;
