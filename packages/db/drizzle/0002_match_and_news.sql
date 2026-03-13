CREATE TYPE "public"."match_format" AS ENUM('1v1', '2v2', 'ffa');
--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('waiting', 'active', 'completed', 'abandoned');
--> statement-breakpoint
CREATE TYPE "public"."player_role" AS ENUM('player', 'spectator');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(12) NOT NULL,
	"format" "match_format" NOT NULL,
	"status" "match_status" DEFAULT 'waiting' NOT NULL,
	"host_user_id" uuid,
	"win_target" integer NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"winner_id" varchar(50),
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_sessions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_name" varchar(100),
	"display_name" varchar(100) NOT NULL,
	"role" "player_role" DEFAULT 'player' NOT NULL,
	"team_id" integer,
	"color" varchar(20) NOT NULL,
	"final_score" integer,
	"is_winner" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" varchar(500) NOT NULL,
	"title" varchar(300) NOT NULL,
	"excerpt" text,
	"thumbnail_url" varchar(500),
	"source" varchar(100) NOT NULL,
	"published_at" timestamp,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_players" ADD CONSTRAINT "match_players_session_id_match_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."match_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_match_sessions_code" ON "match_sessions" USING btree ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_sessions_host_user_id" ON "match_sessions" USING btree ("host_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_sessions_status" ON "match_sessions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_players_session_id" ON "match_players" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_players_user_id" ON "match_players" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_news_articles_url" ON "news_articles" USING btree ("url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_articles_scraped_at" ON "news_articles" USING btree ("scraped_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_articles_published_at" ON "news_articles" USING btree ("published_at");
