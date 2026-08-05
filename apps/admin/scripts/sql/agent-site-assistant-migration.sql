-- Flag one AI agent as the site-wide chatbot assistant (idempotent).
ALTER TABLE "gemini_agents" ADD COLUMN IF NOT EXISTS "is_site_assistant" BOOLEAN NOT NULL DEFAULT false;
