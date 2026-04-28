CREATE TABLE IF NOT EXISTS "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"payout_emails" boolean DEFAULT true NOT NULL,
	"security_emails" boolean DEFAULT true NOT NULL,
	"product_emails" boolean DEFAULT false NOT NULL,
	"compact_mode" boolean DEFAULT false NOT NULL,
	"default_dashboard_route" text DEFAULT '/dashboard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS user_settings_owner_or_admin ON "user_settings";--> statement-breakpoint
CREATE POLICY user_settings_owner_or_admin ON "user_settings"
  FOR ALL
  USING (app_private.is_admin() OR user_id = app_private.current_user_id())
  WITH CHECK (app_private.is_admin() OR user_id = app_private.current_user_id());
