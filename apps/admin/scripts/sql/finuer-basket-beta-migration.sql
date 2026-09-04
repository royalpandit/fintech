-- Basket beta against its benchmark, from aligned daily returns.
--
-- Lets the UI show a risk-adjusted alpha (Jensen's) alongside the plain excess
-- return. Without beta, "alpha" is only the difference between two returns and
-- says nothing about whether the extra return was paid for with extra risk.
--
-- Nullable: beta needs ~30 overlapping sessions, and a basket whose holdings
-- have short histories genuinely has no measurable beta. NULL is the honest
-- answer there — a default of 1.0 would silently assert "moves with the index".
ALTER TABLE "finuer_basket_performance"
  ADD COLUMN IF NOT EXISTS "beta" NUMERIC(9,4);
