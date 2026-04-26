ALTER TYPE "public"."recipient_status" ADD VALUE IF NOT EXISTS 'sending';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "bags_launch_signature" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "bags_launch_wallet" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "bags_pool_claimer_wallet" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "bags_token_metadata" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "bags_initial_buy_lamports" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "token_website_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "token_twitter_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "token_telegram_url" text;--> statement-breakpoint
ALTER TABLE "payout_recipients" ADD COLUMN IF NOT EXISTS "send_attempt_id" text;--> statement-breakpoint
ALTER TABLE "payout_recipients" ADD COLUMN IF NOT EXISTS "sending_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipients_send_attempt_idx" ON "payout_recipients" USING btree ("send_attempt_id");--> statement-breakpoint
