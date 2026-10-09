ALTER TABLE "obligations" ADD COLUMN IF NOT EXISTS "assigned_to" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "obligations" ADD CONSTRAINT "obligations_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_assigned_to_idx" ON "obligations" ("assigned_to");
