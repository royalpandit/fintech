-- Trade idea levels on community posts (entry, CMP, target, stop loss)

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS entry_price DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS cmp DECIMAL(18, 4);
