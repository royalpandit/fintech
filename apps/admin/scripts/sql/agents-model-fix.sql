-- Point every agent at the "-latest" flash alias. Specific dated Gemini models
-- (gemini-2.0-flash, gemini-2.5-flash, …) now 404 with "no longer available";
-- the alias always tracks Google's current flash model, so it won't break again.
UPDATE "gemini_agents"
SET "model" = 'gemini-flash-latest'
WHERE "model" NOT LIKE '%latest%';
