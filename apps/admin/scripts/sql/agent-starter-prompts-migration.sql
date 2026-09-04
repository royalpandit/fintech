-- Per-agent starter prompts, shown as clickable chips on an empty chat.
--
-- A text[] rather than a join table or JSON: it is an ordered list of short
-- strings with no attributes of its own, always read and written whole, and
-- never queried across agents. DEFAULT '{}' so every existing agent gets an
-- empty list and the empty state simply renders no chips until someone fills
-- them in from /super-admin/agents.
ALTER TABLE "gemini_agents"
  ADD COLUMN IF NOT EXISTS "starter_prompts" TEXT[] NOT NULL DEFAULT '{}';
