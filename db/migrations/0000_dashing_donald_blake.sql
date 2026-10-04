CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
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
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"business_type" text NOT NULL,
	"turnover_bracket" text NOT NULL,
	"has_employees" boolean DEFAULT false NOT NULL,
	"gstin" text,
	"pan_last4" text,
	"registrations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"form_code" text NOT NULL,
	"name" text NOT NULL,
	"frequency" text NOT NULL,
	"due_formula" jsonb NOT NULL,
	"shift_on_holiday" text DEFAULT 'next_working_day' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"version" integer DEFAULT 1 NOT NULL,
	"source_url" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_log" (
	"id" text PRIMARY KEY NOT NULL,
	"reminder_id" text NOT NULL,
	"attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result" text NOT NULL,
	"provider_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"filing_id" text,
	"r2_key" text NOT NULL,
	"checksum" text,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" text,
	"retain_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"obligation_id" text NOT NULL,
	"filed_on" timestamp with time zone NOT NULL,
	"filed_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'ALL' NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"subscription_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text NOT NULL,
	"razorpay_invoice_id" text,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obligations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"business_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"rule_version" integer DEFAULT 1 NOT NULL,
	"period_label" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'business' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"obligation_id" text NOT NULL,
	"channel" text NOT NULL,
	"offset_days" integer NOT NULL,
	"send_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"changed_by" text NOT NULL,
	"change" text NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_conditions" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"field" text NOT NULL,
	"operator" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"applies_to" jsonb,
	"period_label" text NOT NULL,
	"new_due_date" date NOT NULL,
	"source_url" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"razorpay_customer_id" text,
	"razorpay_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_log" ADD CONSTRAINT "delivery_log_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_filing_id_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."filings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filings" ADD CONSTRAINT "filings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filings" ADD CONSTRAINT "filings_obligation_id_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."obligations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filings" ADD CONSTRAINT "filings_filed_by_user_id_fk" FOREIGN KEY ("filed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_rule_id_compliance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_obligation_id_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."obligations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_audit_log" ADD CONSTRAINT "rule_audit_log_rule_id_compliance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_conditions" ADD CONSTRAINT "rule_conditions_rule_id_compliance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_overrides" ADD CONSTRAINT "rule_overrides_rule_id_compliance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "businesses_organization_id_idx" ON "businesses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "compliance_rules_form_code_idx" ON "compliance_rules" USING btree ("form_code");--> statement-breakpoint
CREATE INDEX "delivery_log_reminder_idx" ON "delivery_log" USING btree ("reminder_id");--> statement-breakpoint
CREATE INDEX "documents_filing_idx" ON "documents" USING btree ("filing_id");--> statement-breakpoint
CREATE INDEX "documents_organization_idx" ON "documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "filings_obligation_idx" ON "filings" USING btree ("obligation_id");--> statement-breakpoint
CREATE INDEX "filings_organization_idx" ON "filings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "holidays_state_date_unique" ON "holidays" USING btree ("state","date");--> statement-breakpoint
CREATE INDEX "holidays_date_idx" ON "holidays" USING btree ("date");--> statement-breakpoint
CREATE INDEX "invoices_organization_idx" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user_unique" ON "memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_org_id_idx" ON "memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "obligations_business_rule_period_unique" ON "obligations" USING btree ("business_id","rule_id","period_label");--> statement-breakpoint
CREATE INDEX "obligations_org_due_date_idx" ON "obligations" USING btree ("organization_id","due_date");--> statement-breakpoint
CREATE INDEX "obligations_business_status_idx" ON "obligations" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_obligation_channel_offset_unique" ON "reminders" USING btree ("obligation_id","channel","offset_days");--> statement-breakpoint
CREATE INDEX "reminders_state_send_at_idx" ON "reminders" USING btree ("state","send_at");--> statement-breakpoint
CREATE INDEX "reminders_organization_idx" ON "reminders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rule_audit_log_rule_idx" ON "rule_audit_log" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "rule_conditions_rule_id_idx" ON "rule_conditions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "rule_overrides_rule_period_idx" ON "rule_overrides" USING btree ("rule_id","period_label");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_organization_unique" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH NOBYPASSRLS INHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT app_user TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;--> statement-breakpoint
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;--> statement-breakpoint
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "organizations_tenant_isolation" ON "organizations" FOR ALL USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR id = NULLIF(current_setting('app.current_org_id', true), '')
) WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR id = NULLIF(current_setting('app.current_org_id', true), '')
);--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "memberships_tenant_isolation" ON "memberships" FOR ALL USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
  OR user_id = NULLIF(current_setting('app.current_user_id', true), '')
) WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
  OR user_id = NULLIF(current_setting('app.current_user_id', true), '')
);--> statement-breakpoint
ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "businesses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "businesses_tenant_isolation" ON "businesses" FOR ALL USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
) WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
);--> statement-breakpoint
ALTER TABLE "obligations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "obligations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "obligations_tenant_isolation" ON "obligations" FOR ALL USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
) WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
);--> statement-breakpoint
ALTER TABLE "filings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "filings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "filings_tenant_isolation" ON "filings" FOR ALL USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
) WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
);--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "documents_tenant_isolation" ON "documents" FOR ALL USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
) WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
);--> statement-breakpoint
ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reminders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "reminders_tenant_isolation" ON "reminders" FOR ALL USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
) WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
);--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "subscriptions_tenant_isolation" ON "subscriptions" FOR ALL USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
) WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
);--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "invoices_tenant_isolation" ON "invoices" FOR ALL USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
) WITH CHECK (
  current_setting('app.bypass_rls', true) = 'on'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')
);