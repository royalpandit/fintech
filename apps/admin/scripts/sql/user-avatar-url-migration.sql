-- Adds a profile-photo URL column to users (idempotent).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
