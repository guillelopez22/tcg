CREATE TABLE IF NOT EXISTS "deck_share_codes" (
	"code" varchar(12) PRIMARY KEY NOT NULL,
	"deck_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deck_share_codes" ADD CONSTRAINT "deck_share_codes_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deck_share_codes_deck_id" ON "deck_share_codes" USING btree ("deck_id");