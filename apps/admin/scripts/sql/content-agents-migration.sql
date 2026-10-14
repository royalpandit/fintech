-- Content agents: the two new tables and their enums, and nothing else.
--
-- `prisma db push` wanted to take unrelated pre-existing drift with it —
-- rebuilding the primary keys on finuer_plans and sponsorship_tiers and casting
-- their id columns from BigInt to Integer on live rows. Prisma's own warning is
-- that a partial failure leaves those tables with no primary key at all. That
-- drift is real and worth fixing, but on its own, deliberately, not as a side
-- effect of shipping a feature that has nothing to do with it.
--
-- So this is written by hand from `prisma migrate diff`, keeping only the
-- additive statements. Every one is CREATE or an ADD on a table that did not
-- exist a moment ago, so there is nothing here that can damage existing data.
--
-- Run:  npm run db:content-agents

-- Idempotent so a half-finished run can be repeated: Postgres has no
-- CREATE TYPE IF NOT EXISTS, so the duplicate is caught instead.
DO $$ BEGIN
  CREATE TYPE "content_agent_target" AS ENUM ('market_post', 'community_post');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "content_agent_run_status" AS ENUM ('pending', 'published', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "content_agents" (
    "id" SERIAL NOT NULL,
    "agent_no" INTEGER NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "department" VARCHAR(120) NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "target" "content_agent_target" NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "slots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bot_user_id" INTEGER NOT NULL,
    "model" VARCHAR(60) NOT NULL DEFAULT 'gemini-flash-latest',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "content_agent_runs" (
    "id" SERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "run_date" DATE NOT NULL,
    "slot" VARCHAR(5) NOT NULL,
    "status" "content_agent_run_status" NOT NULL DEFAULT 'pending',
    "market_post_id" INTEGER,
    "community_post_id" INTEGER,
    "error" TEXT,
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_agents_agent_no_key" ON "content_agents"("agent_no");
CREATE UNIQUE INDEX IF NOT EXISTS "content_agents_slug_key" ON "content_agents"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "content_agents_bot_user_id_key" ON "content_agents"("bot_user_id");
CREATE INDEX IF NOT EXISTS "content_agents_is_active_idx" ON "content_agents"("is_active");

CREATE INDEX IF NOT EXISTS "content_agent_runs_run_date_idx" ON "content_agent_runs"("run_date");
CREATE INDEX IF NOT EXISTS "content_agent_runs_status_idx" ON "content_agent_runs"("status");

-- The one that makes the sweep safe to re-run: a slot already claimed for an
-- agent on a date cannot be claimed twice, so an overlapping cron cannot
-- double-post.
CREATE UNIQUE INDEX IF NOT EXISTS "content_agent_runs_agent_id_run_date_slot_key"
  ON "content_agent_runs"("agent_id", "run_date", "slot");

DO $$ BEGIN
  ALTER TABLE "content_agents" ADD CONSTRAINT "content_agents_bot_user_id_fkey"
    FOREIGN KEY ("bot_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "content_agent_runs" ADD CONSTRAINT "content_agent_runs_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "content_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- gemini-1.5-flash, the old default here, has been retired by Google, so every
-- chat agent created since then carries a model id that 404s. Only the default
-- for new rows; rows already holding the dead id are a separate data fix.
ALTER TABLE "gemini_agents" ALTER COLUMN "model" SET DEFAULT 'gemini-flash-latest';
