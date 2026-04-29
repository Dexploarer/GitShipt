-- Migrate payout_recipients.weight from text to numeric(10,6).
--
-- The column was originally text "for precision", but text accepts any
-- string — including malformed values that wouldn't survive a runtime
-- parse. Storing as numeric(10,6) gets us:
--   - Validation at insert time (bad strings rejected by Postgres)
--   - A CHECK constraint enforcing weight in [0, 1]
--   - Sortable and aggregatable values for admin reporting
--
-- Backfill is defensive: any row whose existing text doesn't match a
-- decimal pattern is set to 0 so the cast can never raise. Any non-zero
-- weight that fails the regex points at a data corruption bug; a 0
-- weight there means the contributor receives nothing rather than
-- silently breaking the migration. The corruption is logged via the
-- AUDIT path, not here.

ALTER TABLE "payout_recipients"
  ADD COLUMN IF NOT EXISTS "weight_numeric" numeric(10, 6);
--> statement-breakpoint

UPDATE "payout_recipients"
SET "weight_numeric" =
  CASE
    WHEN "weight" ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN least(greatest("weight"::numeric, 0), 1)::numeric(10, 6)
    ELSE 0::numeric(10, 6)
  END
WHERE "weight_numeric" IS NULL;
--> statement-breakpoint

ALTER TABLE "payout_recipients"
  ALTER COLUMN "weight_numeric" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "payout_recipients"
  ADD CONSTRAINT "payout_recipients_weight_range"
  CHECK ("weight_numeric" >= 0 AND "weight_numeric" <= 1);
--> statement-breakpoint

ALTER TABLE "payout_recipients"
  DROP COLUMN "weight";
--> statement-breakpoint

ALTER TABLE "payout_recipients"
  RENAME COLUMN "weight_numeric" TO "weight";
