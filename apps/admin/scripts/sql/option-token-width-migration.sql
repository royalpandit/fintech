-- Widen the instrument-token columns so an NSE option identifier fits.
--
-- NSE identifies a contract by a string, not a number:
-- OPTSTKBAJFINANCE23-11-2026CE970.00. That is 34 characters, and these columns
-- were VARCHAR(32) — sized for the numeric tokens Angel One and Dhan return.
-- The ladder of failures was invisible until it wasn't: NIFTY (31 characters)
-- and MARUTI (32) squeezed in, while BAJFINANCE (34) and RELIANCE (33) came
-- back as "value too long for type character varying(32)" raised from inside
-- prisma.paperOrder.create(), with the column name not available — so the order
-- ticket showed the raw ORM error and no order was ever written.
--
-- 64 leaves room: the longest NSE underlying plus a ten-character expiry, the
-- CE/PE and a strike to two decimals lands in the low forties.
--
-- Widening a VARCHAR is a catalogue change in Postgres — no table rewrite, no
-- lock held beyond the statement, and no existing value can fail to fit a
-- larger type. Safe to re-run.
--
-- Run:  npm run db:option-token-width

-- paper_orders is the one that failed. The other two take the same identifier
-- from the same screens — saving an option to a watchlist, tagging one on a
-- post — and would have failed the same way on the next click.
ALTER TABLE "paper_orders"           ALTER COLUMN "token" TYPE VARCHAR(64);
ALTER TABLE "watchlist_items"        ALTER COLUMN "token" TYPE VARCHAR(64);
ALTER TABLE "community_post_symbols" ALTER COLUMN "token" TYPE VARCHAR(64);
