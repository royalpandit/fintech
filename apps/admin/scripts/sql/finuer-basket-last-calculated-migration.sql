-- When a basket's returns were last recomputed.
--
-- lib/finuer-basket-performance.ts has always written `lastCalculatedAt` in its
-- upsert, but the column was never added, so every call threw
-- "Unknown argument `lastCalculatedAt`" — meaning the calculator had never
-- successfully stored a result. That is why every basket showed "—" for every
-- return and carried the default "underperforming" tag.
--
-- Nullable with no default: rows that predate the first successful sweep
-- genuinely have no calculation time, and pretending otherwise ("calculated
-- just now") would be worse than an honest NULL.
ALTER TABLE "finuer_basket_performance"
  ADD COLUMN IF NOT EXISTS "last_calculated_at" TIMESTAMP(3);
