ALTER TABLE "escrow_holdings" ADD COLUMN IF NOT EXISTS "drain_attempt_id" text;--> statement-breakpoint
ALTER TABLE "escrow_holdings" ADD COLUMN IF NOT EXISTS "draining_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "escrow_holdings" ADD COLUMN IF NOT EXISTS "drain_error" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "escrow_drain_attempt_idx" ON "escrow_holdings" USING btree ("drain_attempt_id");--> statement-breakpoint
