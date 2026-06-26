-- Backfill existing competitions with prediction question + options (demo data)

UPDATE competitions
SET
  question = 'Which banking stock will perform the best this week?',
  description = 'Predict which banking stock will deliver the highest return during the competition window. Correct predictions earn Finuer reputation points.',
  short_description = 'Weekly banking stock prediction challenge.',
  participation_start_date = COALESCE(participation_start_date, start_date),
  participation_end_date = COALESCE(participation_end_date, end_date),
  reputation_points = COALESCE(NULLIF(reputation_points, 0), 10),
  tags = ARRAY['Banking', 'Stocks']::text[]
WHERE id = 1 AND (question IS NULL OR question = '');

INSERT INTO competition_options (competition_id, label, sort_order)
SELECT 1, opt.label, opt.sort_order
FROM (VALUES
  ('SBI', 0),
  ('HDFC Bank', 1),
  ('ICICI Bank', 2),
  ('Axis Bank', 3)
) AS opt(label, sort_order)
WHERE EXISTS (SELECT 1 FROM competitions WHERE id = 1)
  AND NOT EXISTS (SELECT 1 FROM competition_options WHERE competition_id = 1);

UPDATE competitions
SET
  question = 'Which sector will outperform this month?',
  description = 'Pick the sector you think will lead the market this month.',
  short_description = 'Monthly sector prediction challenge.',
  participation_start_date = COALESCE(participation_start_date, start_date),
  participation_end_date = COALESCE(participation_end_date, end_date),
  reputation_points = 25,
  tags = ARRAY['Economy', 'Stocks']::text[]
WHERE id = 2 AND (question IS NULL OR question = '');

INSERT INTO competition_options (competition_id, label, sort_order)
SELECT 2, opt.label, opt.sort_order
FROM (VALUES
  ('Banking', 0),
  ('IT', 1),
  ('Pharma', 2),
  ('Defence', 3)
) AS opt(label, sort_order)
WHERE EXISTS (SELECT 1 FROM competitions WHERE id = 2)
  AND NOT EXISTS (SELECT 1 FROM competition_options WHERE competition_id = 2);
