ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "keywords" text[] DEFAULT '{}';
