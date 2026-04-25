CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."project_member_role" AS ENUM('project_owner', 'project_moderator');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'live', 'paused', 'killed');--> statement-breakpoint
CREATE TYPE "public"."snapshot_status" AS ENUM('pending', 'frozen', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'claiming', 'distributing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recipient_status" AS ENUM('pending', 'sent', 'confirmed', 'failed', 'escrow');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributor_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"contributor_id" text NOT NULL,
	"user_id" text,
	"wallet_address" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributors" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"gh_user_id" text NOT NULL,
	"gh_username" text NOT NULL,
	"avatar_url" text,
	"score" double precision DEFAULT 0 NOT NULL,
	"rank" integer,
	"inputs" jsonb DEFAULT '{"mergedPRs":0,"commits":0,"reviews":0,"issues":0,"netLines":0}'::jsonb NOT NULL,
	"excluded" text DEFAULT 'false' NOT NULL,
	"excluded_reason" text,
	"last_indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrow_holdings" (
	"id" text PRIMARY KEY NOT NULL,
	"contributor_id" text NOT NULL,
	"token_mint" text,
	"amount_lamports" bigint NOT NULL,
	"source_payout_id" text,
	"drained_at" timestamp with time zone,
	"drain_signature" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gh_indexer_state" (
	"project_id" text PRIMARY KEY NOT NULL,
	"last_event_cursor" text,
	"last_commit_sha" text,
	"last_full_sync_at" timestamp with time zone,
	"last_incremental_sync_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"github_id" text,
	"github_username" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"mfa_secret_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"chain" text DEFAULT 'solana' NOT NULL,
	"label" text,
	"is_primary" text DEFAULT 'false' NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"role" "project_member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"gh_owner" text NOT NULL,
	"gh_repo" text NOT NULL,
	"gh_repo_id" text NOT NULL,
	"gh_installation_id" text,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"token_mint" text,
	"bags_launch_id" text,
	"bags_config_key" text,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"platform_fee_bps" integer DEFAULT 500 NOT NULL,
	"scoring_config" jsonb NOT NULL,
	"payout_config" jsonb NOT NULL,
	"paused_at" timestamp with time zone,
	"paused_reason" text,
	"killed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"formula_version" text NOT NULL,
	"leaderboard" jsonb NOT NULL,
	"merkle_root" text NOT NULL,
	"total_fees_lamports" bigint DEFAULT 0 NOT NULL,
	"status" "snapshot_status" DEFAULT 'pending' NOT NULL,
	"forced" text DEFAULT 'false' NOT NULL,
	"forced_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"payout_id" text NOT NULL,
	"contributor_id" text NOT NULL,
	"wallet_address" text,
	"amount_lamports" bigint NOT NULL,
	"rank" integer NOT NULL,
	"weight" text NOT NULL,
	"status" "recipient_status" DEFAULT 'pending' NOT NULL,
	"tx_signature" text,
	"idempotency_key" text NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_id" text NOT NULL,
	"project_id" text NOT NULL,
	"total_amount_lamports" bigint DEFAULT 0 NOT NULL,
	"claim_signature" text,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks_inbox" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"signature" text,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributor_claims" ADD CONSTRAINT "contributor_claims_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_claims" ADD CONSTRAINT "contributor_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributors" ADD CONSTRAINT "contributors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_holdings" ADD CONSTRAINT "escrow_holdings_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gh_indexer_state" ADD CONSTRAINT "gh_indexer_state_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_recipients" ADD CONSTRAINT "payout_recipients_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_recipients" ADD CONSTRAINT "payout_recipients_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_contributor_uq" ON "contributor_claims" USING btree ("contributor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contributors_project_gh_uq" ON "contributors" USING btree ("project_id","gh_user_id");--> statement-breakpoint
CREATE INDEX "contributors_project_rank_idx" ON "contributors" USING btree ("project_id","rank");--> statement-breakpoint
CREATE INDEX "contributors_gh_username_idx" ON "contributors" USING btree ("gh_username");--> statement-breakpoint
CREATE INDEX "escrow_contributor_idx" ON "escrow_holdings" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX "escrow_expires_idx" ON "escrow_holdings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounts_provider_idx" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_github_username_idx" ON "users" USING btree ("github_username");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_address_uq" ON "wallets" USING btree ("user_id","address");--> statement-breakpoint
CREATE INDEX "wallets_address_idx" ON "wallets" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_project_uq" ON "project_memberships" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "memberships_project_idx" ON "project_memberships" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_gh_repo_uq" ON "projects" USING btree ("gh_owner","gh_repo");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "snapshots_project_taken_idx" ON "snapshots" USING btree ("project_id","taken_at");--> statement-breakpoint
CREATE INDEX "snapshots_status_idx" ON "snapshots" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "recipients_idempotency_uq" ON "payout_recipients" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "recipients_payout_idx" ON "payout_recipients" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "recipients_contributor_idx" ON "payout_recipients" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX "recipients_status_idx" ON "payout_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payouts_status_scheduled_idx" ON "payouts" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_snapshot_uq" ON "payouts" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "payouts_project_idx" ON "payouts" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhooks_source_event_uq" ON "webhooks_inbox" USING btree ("source","event_id");--> statement-breakpoint
CREATE INDEX "webhooks_type_idx" ON "webhooks_inbox" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "webhooks_processed_idx" ON "webhooks_inbox" USING btree ("processed_at");