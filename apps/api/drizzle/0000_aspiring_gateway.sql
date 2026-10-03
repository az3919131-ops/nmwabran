CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'dept', 'pm');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"username" text DEFAULT '—' NOT NULL,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"detail" text DEFAULT '' NOT NULL,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_materials" (
	"code" text PRIMARY KEY NOT NULL,
	"ar" text NOT NULL,
	"en" text NOT NULL,
	"unit" text NOT NULL,
	"price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"klass" text DEFAULT 'detail' NOT NULL,
	"grp" text DEFAULT 'acc' NOT NULL,
	"added" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_works" (
	"code" text PRIMARY KEY NOT NULL,
	"ar" text NOT NULL,
	"en" text NOT NULL,
	"unit" text NOT NULL,
	"price" numeric(18, 4) DEFAULT '0' NOT NULL,
	"grp" text DEFAULT 'inst' NOT NULL,
	"added" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cr_number" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_key" text NOT NULL,
	"work_order_id" uuid,
	"sent_by" uuid,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role_label" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_recipients_lower" CHECK ("email_recipients"."email" = lower("email_recipients"."email"))
);
--> statement-breakpoint
CREATE TABLE "emergency_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_no" text NOT NULL,
	"work_order_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"ord" integer DEFAULT 0 NOT NULL,
	"point_id" text NOT NULL,
	"lat" numeric(10, 6) NOT NULL,
	"lon" numeric(10, 6) NOT NULL,
	"src" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'PT' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"work_order_id" uuid,
	"file_id" uuid,
	"user_id" uuid,
	"kind" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"report" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layout_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"idx" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"code" text NOT NULL,
	"issued" numeric(18, 4) DEFAULT '0' NOT NULL,
	"required" numeric(18, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"new_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"mail_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"work_order_id" uuid NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipient_report_scope" (
	"recipient_id" uuid NOT NULL,
	"report_key" text NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL,
	CONSTRAINT "recipient_report_scope_recipient_id_report_key_pk" PRIMARY KEY("recipient_id","report_key")
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_key" text NOT NULL,
	"work_order_id" uuid,
	"cron" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"lang" text DEFAULT 'ar' NOT NULL,
	"attach_pdf" boolean DEFAULT true NOT NULL,
	"attach_xlsx" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_by" uuid,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rmu_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"ord" integer DEFAULT 0 NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	"feeder" text DEFAULT '' NOT NULL,
	"rmu" text NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"tr" text DEFAULT '' NOT NULL,
	"relay" text DEFAULT '—' NOT NULL,
	"model" text DEFAULT '—' NOT NULL,
	"set_done" boolean DEFAULT false NOT NULL,
	"ct_ratio" text DEFAULT '' NOT NULL,
	"earth_ohm" text DEFAULT '' NOT NULL,
	"gps" text DEFAULT '' NOT NULL,
	"gps_src" text,
	"lat" numeric(10, 6),
	"lon" numeric(10, 6)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"unlocked" boolean DEFAULT false NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid,
	"period" text DEFAULT '' NOT NULL,
	"metric" text NOT NULL,
	"value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"name" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"mime" text DEFAULT '' NOT NULL,
	"ext" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'doc' NOT NULL,
	"status" text DEFAULT 'reference' NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"storage_key" text,
	"ident" jsonb,
	"wo_state" text,
	"report" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"geo_n" integer DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_contractors" (
	"user_id" uuid NOT NULL,
	"contractor_id" uuid NOT NULL,
	CONSTRAINT "user_contractors_user_id_contractor_id_pk" PRIMARY KEY("user_id","contractor_id")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module" text NOT NULL,
	"view" boolean DEFAULT false NOT NULL,
	"edit" boolean DEFAULT false NOT NULL,
	"del" boolean DEFAULT false NOT NULL,
	"exp" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'pm' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"password_hash" text NOT NULL,
	"all_contractors" boolean DEFAULT true NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"response_code" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"code" text NOT NULL,
	"plan" numeric(18, 4) DEFAULT '0' NOT NULL,
	"exec" numeric(18, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wo_number" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"site" text DEFAULT '' NOT NULL,
	"admin" text DEFAULT 'نجران' NOT NULL,
	"sector" text DEFAULT 'الجنوبي' NOT NULL,
	"contractor_id" uuid NOT NULL,
	"consultant_id" uuid,
	"approved_date" text DEFAULT '' NOT NULL,
	"est_mat" numeric(18, 2) DEFAULT '0' NOT NULL,
	"est_inst" numeric(18, 2) DEFAULT '0' NOT NULL,
	"est_ind" numeric(18, 2) DEFAULT '0' NOT NULL,
	"derived_at" timestamp with time zone,
	"factors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"invoice" jsonb,
	"prev_total" numeric(18, 2),
	"accept" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_recipients" ADD CONSTRAINT "email_recipients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_tickets" ADD CONSTRAINT "emergency_tickets_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_points" ADD CONSTRAINT "geo_points_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_log" ADD CONSTRAINT "import_log_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_log" ADD CONSTRAINT "import_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_sheets" ADD CONSTRAINT "layout_sheets_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_lines" ADD CONSTRAINT "material_lines_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_report_scope" ADD CONSTRAINT "recipient_report_scope_recipient_id_email_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."email_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rmu_units" ADD CONSTRAINT "rmu_units_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contractors" ADD CONSTRAINT "user_contractors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contractors" ADD CONSTRAINT "user_contractors_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_lines" ADD CONSTRAINT "work_order_lines_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_consultant_id_consultants_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."consultants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_uq" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "contractors_name_uq" ON "contractors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_log_report_idx" ON "email_log" USING btree ("report_key");--> statement-breakpoint
CREATE UNIQUE INDEX "email_recipients_email_uq" ON "email_recipients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "geo_points_wo_idx" ON "geo_points" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "layout_sheets_wo_idx" ON "layout_sheets" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_lines_uq" ON "material_lines" USING btree ("work_order_id","code");--> statement-breakpoint
CREATE INDEX "project_snapshots_wo_idx" ON "project_snapshots" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "rmu_units_wo_idx" ON "rmu_units" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "uploaded_files_wo_idx" ON "uploaded_files" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_permissions_uq" ON "user_permissions" USING btree ("user_id","module");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_lines_uq" ON "work_order_lines" USING btree ("work_order_id","code");--> statement-breakpoint
CREATE INDEX "work_orders_wo_idx" ON "work_orders" USING btree ("wo_number");--> statement-breakpoint
CREATE INDEX "work_orders_contractor_idx" ON "work_orders" USING btree ("contractor_id");