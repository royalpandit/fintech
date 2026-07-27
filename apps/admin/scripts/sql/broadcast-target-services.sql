ALTER TABLE dm_broadcasts ADD COLUMN IF NOT EXISTS target_service_ids INTEGER[] NOT NULL DEFAULT '{}';
