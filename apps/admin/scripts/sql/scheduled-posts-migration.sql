-- Adds scheduled publishing to advisor market posts. A post with a future
-- scheduled_at stays unpublished (published_at NULL) until its time arrives,
-- at which point it's published lazily on the next feed read.
-- Idempotent (see db-migration-workflow).

ALTER TABLE market_posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP(3);
