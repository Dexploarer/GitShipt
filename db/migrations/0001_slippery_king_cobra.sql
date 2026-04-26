ALTER TYPE "public"."project_status" ADD VALUE 'simulated_live';--> statement-breakpoint
ALTER TYPE "public"."payout_status" ADD VALUE 'simulated';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "simulated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "simulated_at" timestamp with time zone;