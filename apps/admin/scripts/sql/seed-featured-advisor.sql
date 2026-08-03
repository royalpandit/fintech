-- Demo seed: feature the two most active analysts for 30 days so the
-- "Featured Analysts / Sponsored" rail is populated. Safe to re-run.
UPDATE advisor_profiles
SET featured_until = NOW() + INTERVAL '30 days', featured_tier = 'monthly'
WHERE user_id IN (
  SELECT advisor_user_id
  FROM market_posts
  WHERE compliance_status = 'approved'
    AND deleted_at IS NULL
    AND published_at IS NOT NULL
  GROUP BY advisor_user_id
  ORDER BY COUNT(*) DESC
  LIMIT 2
);
