CREATE TYPE "public"."card_condition" AS ENUM('mint', 'near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged');--> statement-breakpoint
CREATE TYPE "public"."card_variant" AS ENUM('normal', 'alt_art', 'overnumbered', 'signature');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'sold', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."wishlist_type" AS ENUM('want', 'trade');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"total" integer NOT NULL,
	"release_date" date NOT NULL,
	"description" varchar(1000),
	"tcgplayer_group_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sets_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "sets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(100) NOT NULL,
	"number" varchar(20) NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"clean_name" varchar(255) NOT NULL,
	"set_id" uuid NOT NULL,
	"rarity" varchar(50) NOT NULL,
	"card_type" varchar(50) NOT NULL,
	"domain" varchar(100) NOT NULL,
	"energy_cost" integer,
	"power_cost" integer,
	"might" integer,
	"description" text,
	"flavor_text" text,
	"image_small" varchar(500),
	"image_large" varchar(500),
	"tcgplayer_id" integer,
	"tcgplayer_url" varchar(500),
	"is_product" boolean DEFAULT false NOT NULL,
	"keywords" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cards_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"tcgplayer_product_id" integer NOT NULL,
	"low_price" numeric(10, 2),
	"mid_price" numeric(10, 2),
	"high_price" numeric(10, 2),
	"market_price" numeric(10, 2),
	"direct_low_price" numeric(10, 2),
	"foil_low_price" numeric(10, 2),
	"foil_mid_price" numeric(10, 2),
	"foil_high_price" numeric(10, 2),
	"foil_market_price" numeric(10, 2),
	"foil_direct_low_price" numeric(10, 2),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_card_prices_card_id" UNIQUE("card_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"display_name" varchar(100),
	"avatar_url" varchar(500),
	"bio" text,
	"city" varchar(100),
	"whatsapp_phone" varchar(20),
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_connect_id" varchar(255),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token" varchar(500) NOT NULL,
	"user_agent" varchar(500),
	"ip_address" varchar(45),
	"is_revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"variant" "card_variant" DEFAULT 'normal' NOT NULL,
	"condition" "card_condition" DEFAULT 'near_mint' NOT NULL,
	"purchase_price" numeric(10, 2),
	"photo_url" varchar(500),
	"photo_key" varchar(500),
	"notes" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"type" "wishlist_type" NOT NULL,
	"preferred_variant" "card_variant",
	"max_price" numeric(10, 2),
	"asking_price" numeric(10, 2),
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deck_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"zone" varchar(20) DEFAULT 'main' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"cover_card_id" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"domain" varchar(100),
	"tier" varchar(2),
	"tournament" varchar(200),
	"region" varchar(50),
	"placement" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deck_share_codes" (
	"code" varchar(12) PRIMARY KEY NOT NULL,
	"deck_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"price_in_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"condition" "card_condition" NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"image_urls" text[],
	"city" varchar(100),
	"shipping_available" varchar(20) DEFAULT 'local' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"subtotal_in_cents" integer NOT NULL,
	"platform_fee_in_cents" integer NOT NULL,
	"total_in_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_transfer_id" varchar(255),
	"shipping_address" text,
	"tracking_number" varchar(100),
	"notes" text,
	"paid_at" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"dispute_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cards" ADD CONSTRAINT "cards_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_prices" ADD CONSTRAINT "card_prices_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collections" ADD CONSTRAINT "collections_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decks" ADD CONSTRAINT "decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decks" ADD CONSTRAINT "decks_cover_card_id_cards_id_fk" FOREIGN KEY ("cover_card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deck_share_codes" ADD CONSTRAINT "deck_share_codes_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listings" ADD CONSTRAINT "listings_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cards_set_id" ON "cards" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cards_rarity" ON "cards" USING btree ("rarity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cards_card_type" ON "cards" USING btree ("card_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cards_domain" ON "cards" USING btree ("domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cards_clean_name" ON "cards" USING btree ("clean_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cards_is_product" ON "cards" USING btree ("is_product");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_card_prices_tcgplayer_product_id" ON "card_prices" USING btree ("tcgplayer_product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_card_prices_card_id" ON "card_prices" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_whatsapp_phone" ON "users" USING btree ("whatsapp_phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_city" ON "users" USING btree ("city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_refresh_token" ON "sessions" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_collections_user_card" ON "collections" USING btree ("user_id","card_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_collections_user_id" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_collections_card_id" ON "collections" USING btree ("card_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_wishlists_user_card_type" ON "wishlists" USING btree ("user_id","card_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_deck_cards_deck_card_zone" ON "deck_cards" USING btree ("deck_id","card_id","zone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deck_cards_deck_id" ON "deck_cards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decks_user_id" ON "decks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decks_is_public" ON "decks" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deck_share_codes_deck_id" ON "deck_share_codes" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listings_seller_id" ON "listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listings_card_id" ON "listings" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listings_status" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listings_city" ON "listings" USING btree ("city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listings_price" ON "listings" USING btree ("price_in_cents");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listings_created_at" ON "listings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_buyer_id" ON "orders" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_seller_id" ON "orders" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_listing_id" ON "orders" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_stripe_pi" ON "orders" USING btree ("stripe_payment_intent_id");