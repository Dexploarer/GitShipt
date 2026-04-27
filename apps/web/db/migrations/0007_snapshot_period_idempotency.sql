ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "snapshot_period" text;--> statement-breakpoint
UPDATE "snapshots"
SET "snapshot_period" = to_char("taken_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "snapshot_period" IS NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ALTER COLUMN "snapshot_period" SET NOT NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "project_id", "snapshot_period"
      ORDER BY
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM "payouts"
            WHERE "payouts"."snapshot_id" = "snapshots"."id"
          ) THEN 0
          ELSE 1
        END,
        CASE "status"
          WHEN 'paid' THEN 0
          WHEN 'frozen' THEN 1
          WHEN 'pending' THEN 2
          ELSE 3
        END,
        "taken_at" ASC,
        "created_at" ASC,
        "id" ASC
    ) AS rn
  FROM "snapshots"
  WHERE "status" IN ('pending', 'frozen', 'paid')
)
UPDATE "snapshots"
SET "status" = 'failed'
FROM ranked
WHERE "snapshots"."id" = ranked."id"
  AND ranked.rn > 1;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_period_idx" ON "snapshots" USING btree ("snapshot_period");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_project_period_active_uq"
  ON "snapshots" USING btree ("project_id", "snapshot_period")
  WHERE "status" IN ('pending', 'frozen', 'paid');--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "snapshot_period" text;--> statement-breakpoint
UPDATE "payouts"
SET "snapshot_period" = "snapshots"."snapshot_period"
FROM "snapshots"
WHERE "payouts"."snapshot_id" = "snapshots"."id"
  AND "payouts"."snapshot_period" IS NULL;--> statement-breakpoint
UPDATE "payouts"
SET "snapshot_period" = to_char("scheduled_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "snapshot_period" IS NULL;--> statement-breakpoint
ALTER TABLE "payouts" ALTER COLUMN "snapshot_period" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payouts_project_snapshot_period_uq"
  ON "payouts" USING btree ("project_id", "snapshot_period");--> statement-breakpoint
