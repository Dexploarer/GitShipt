-- Add symbol column for draft round-tripping. Nullable so existing rows stay valid.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "symbol" text;
