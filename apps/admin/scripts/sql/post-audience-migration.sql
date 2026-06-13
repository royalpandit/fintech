-- Post audience targeting: who can see an advisor's market post.
-- 'public' = everyone, 'subscribers' = only active subscribers of the advisor.

ALTER TABLE market_posts ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS market_posts_audience_idx ON market_posts(audience);
