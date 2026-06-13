-- Boost a market post: how long it's promoted + which plan was chosen.
-- (No payment is recorded — boosting just sets these fields.)

ALTER TABLE market_posts ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ;
ALTER TABLE market_posts ADD COLUMN IF NOT EXISTS boost_tier VARCHAR(20);

CREATE INDEX IF NOT EXISTS market_posts_boosted_until_idx ON market_posts(boosted_until);
