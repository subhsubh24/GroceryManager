CREATE TYPE "public"."cleanup_load" AS ENUM('low', 'med', 'high');--> statement-breakpoint
CREATE TYPE "public"."consumption_method" AS ENUM('decay_model', 'cadence', 'user_reported');--> statement-breakpoint
CREATE TYPE "public"."conversion_source" AS ENUM('fdc', 'usda', 'heuristic', 'user', 'llm');--> statement-breakpoint
CREATE TYPE "public"."detection_action" AS ENUM('confirm_present', 'new_item', 'qty_adjust', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."domain" AS ENUM('grocery', 'household', 'personal_care');--> statement-breakpoint
CREATE TYPE "public"."ledger_event_type" AS ENUM('purchase', 'consume_recipe', 'consume_inferred', 'vision_confirmed', 'manual_adjust', 'spoilage', 'correction', 'open');--> statement-breakpoint
CREATE TYPE "public"."match_method" AS ENUM('override', 'upc', 'trigram', 'embedding', 'llm', 'manual');--> statement-breakpoint
CREATE TYPE "public"."perishability" AS ENUM('perishable', 'semi_perishable', 'shelf_stable');--> statement-breakpoint
CREATE TYPE "public"."preference_polarity" AS ENUM('positive', 'negative', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."preference_source" AS ENUM('onboarding_q', 'meal_log', 'skip', 'reorder', 'waste', 'rating', 'chat', 'correction');--> statement-breakpoint
CREATE TYPE "public"."purchase_source" AS ENUM('gmail_amazon', 'gmail_wfm', 'gmail_instacart', 'amazon_scrape', 'manual', 'barcode');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('parsed', 'needs_review', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."recipe_provider" AS ENUM('spoonacular', 'themealdb', 'user');--> statement-breakpoint
CREATE TYPE "public"."retailer" AS ENUM('amazon', 'whole_foods', 'instacart', 'other');--> statement-breakpoint
CREATE TYPE "public"."scan_location" AS ENUM('fridge', 'pantry', 'freezer', 'other');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('processing', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."shopping_item_reason" AS ENUM('predicted_runout', 'recipe_need', 'low_stock', 'manual');--> statement-breakpoint
CREATE TYPE "public"."shopping_list_generated_by" AS ENUM('reorder_engine', 'recipe_plan', 'agent', 'manual');--> statement-breakpoint
CREATE TYPE "public"."shopping_list_status" AS ENUM('active', 'pushed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."stock_source" AS ENUM('derived', 'user_confirmed');--> statement-breakpoint
CREATE TYPE "public"."stock_status" AS ENUM('in_stock', 'low', 'out', 'expired_likely');--> statement-breakpoint
CREATE TYPE "public"."unit_dimension" AS ENUM('MASS', 'VOLUME', 'COUNT', 'DISCRETE');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "canonical_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" "domain" DEFAULT 'grocery' NOT NULL,
	"category" text,
	"base_unit_id" uuid NOT NULL,
	"shelf_life_pantry_days" integer,
	"shelf_life_fridge_days" integer,
	"shelf_life_freezer_days" integer,
	"perishability" "perishability" DEFAULT 'shelf_stable' NOT NULL,
	"embedding" vector(1536),
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"is_staple" boolean DEFAULT false NOT NULL,
	"fdc_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consumption_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_item_id" uuid NOT NULL,
	"base_qty" numeric(12, 3) NOT NULL,
	"method" "consumption_method" NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingredient_match_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_text" text,
	"upc" text,
	"canonical_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_unit_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_item_id" uuid NOT NULL,
	"from_unit_id" uuid NOT NULL,
	"to_unit_id" uuid NOT NULL,
	"factor" numeric(16, 6) NOT NULL,
	"source" "conversion_source" DEFAULT 'heuristic' NOT NULL,
	"confidence" real DEFAULT 0.7 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipe_id" uuid,
	"free_text" text,
	"servings_made" real,
	"meal_type" text,
	"cooked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decremented_pantry" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"expires_at" timestamp with time zone,
	"history_id" text,
	"watch_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pantry_scan_detections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pantry_scan_id" uuid NOT NULL,
	"canonical_item_id" uuid,
	"raw_label" text NOT NULL,
	"qty_estimate" numeric(12, 3),
	"unit_guess" text,
	"bounding_box" jsonb,
	"presence_confidence" real DEFAULT 0.5 NOT NULL,
	"qty_confidence" real DEFAULT 0.3 NOT NULL,
	"match_method" "match_method",
	"action" "detection_action",
	"user_confirmed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pantry_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"location" "scan_location" DEFAULT 'fridge' NOT NULL,
	"image_blob_urls" text[] DEFAULT '{}' NOT NULL,
	"model" text,
	"status" "scan_status" DEFAULT 'processing' NOT NULL,
	"detection_confidence" real,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pantry_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_item_id" uuid NOT NULL,
	"base_qty_on_hand" numeric(12, 3) DEFAULT '0' NOT NULL,
	"confidence" real DEFAULT 0.7 NOT NULL,
	"last_purchase_at" timestamp with time zone,
	"last_confirmed_at" timestamp with time zone,
	"estimated_run_out_at" timestamp with time zone,
	"est_consumption_rate_per_day" numeric(16, 6),
	"opened_at" timestamp with time zone,
	"status" "stock_status" DEFAULT 'in_stock' NOT NULL,
	"source" "stock_source" DEFAULT 'derived' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preference_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"value" text,
	"polarity" "preference_polarity" DEFAULT 'neutral' NOT NULL,
	"source" "preference_source" NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_item_id" uuid NOT NULL,
	"upc" text,
	"gtin" text,
	"brand" text,
	"display_name" text NOT NULL,
	"retailer" "retailer" DEFAULT 'other' NOT NULL,
	"package_qty" numeric(12, 3),
	"package_unit_id" uuid,
	"pack_count" integer DEFAULT 1 NOT NULL,
	"image_url" text,
	"instacart_product_id" text,
	"asin" text,
	"subscribe_save_eligible" boolean,
	"last_seen_price_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid,
	"canonical_item_id" uuid,
	"raw_text" text NOT NULL,
	"raw_qty" text,
	"raw_unit_text" text,
	"parsed_qty" numeric(12, 3),
	"parsed_unit_id" uuid,
	"base_qty" numeric(12, 3),
	"unit_price_cents" integer,
	"line_total_cents" integer,
	"match_confidence" real,
	"match_method" "match_method",
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "purchase_source" NOT NULL,
	"retailer" "retailer" DEFAULT 'other' NOT NULL,
	"external_order_id" text,
	"gmail_message_id" text,
	"purchased_at" timestamp with time zone,
	"total_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"raw_blob_url" text,
	"status" "purchase_status" DEFAULT 'parsed' NOT NULL,
	"parse_confidence" real,
	"parser_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"keys_p256dh" text NOT NULL,
	"keys_auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"canonical_item_id" uuid,
	"raw_text" text NOT NULL,
	"qty" numeric(12, 3),
	"unit_id" uuid,
	"base_qty" numeric(12, 3),
	"is_optional" boolean DEFAULT false NOT NULL,
	"aisle" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "recipe_provider" NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"image_url" text,
	"servings" integer,
	"ready_minutes" integer,
	"hands_on_minutes" integer,
	"cleanup_load" "cleanup_load",
	"effort_score" real,
	"one_pan" boolean DEFAULT false NOT NULL,
	"sheet_pan" boolean DEFAULT false NOT NULL,
	"no_cook" boolean DEFAULT false NOT NULL,
	"leftover_friendly" boolean DEFAULT false NOT NULL,
	"equipment_needed" text[] DEFAULT '{}' NOT NULL,
	"instructions" jsonb,
	"cuisines" text[] DEFAULT '{}' NOT NULL,
	"dish_types" text[] DEFAULT '{}' NOT NULL,
	"diets" text[] DEFAULT '{}' NOT NULL,
	"nutrition" jsonb,
	"source_url" text,
	"popularity_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reorder_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_item_id" uuid NOT NULL,
	"is_staple" boolean DEFAULT false NOT NULL,
	"target_par_qty" numeric(12, 3),
	"reorder_point_qty" numeric(12, 3),
	"lead_time_days" integer DEFAULT 2 NOT NULL,
	"min_interval_days" integer DEFAULT 7 NOT NULL,
	"preferred_product_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reorder_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_item_id" uuid NOT NULL,
	"predicted_run_out_at" timestamp with time zone,
	"consumption_rate_per_day" numeric(16, 6),
	"recommend_qty" numeric(12, 3),
	"recommend_by_date" timestamp with time zone,
	"confidence" real,
	"rationale" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shopping_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopping_list_id" uuid NOT NULL,
	"canonical_item_id" uuid NOT NULL,
	"product_id" uuid,
	"qty" numeric(12, 3),
	"unit_id" uuid,
	"reason" "shopping_item_reason" DEFAULT 'manual' NOT NULL,
	"checked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT 'Shopping list' NOT NULL,
	"status" "shopping_list_status" DEFAULT 'active' NOT NULL,
	"generated_by" "shopping_list_generated_by" DEFAULT 'reorder_engine' NOT NULL,
	"retailer" "retailer" DEFAULT 'instacart' NOT NULL,
	"instacart_page_url" text,
	"amazon_cart_url" text,
	"pushed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_item_id" uuid NOT NULL,
	"event_type" "ledger_event_type" NOT NULL,
	"base_qty_delta" numeric(12, 3) NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"ref_type" text,
	"ref_id" uuid,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "units_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"dimension" "unit_dimension" NOT NULL,
	"to_base_factor" numeric(16, 6),
	"is_metric" boolean DEFAULT false NOT NULL,
	CONSTRAINT "units_of_measure_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_models" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"diets" text[] DEFAULT '{}' NOT NULL,
	"allergens" text[] DEFAULT '{}' NOT NULL,
	"disliked_item_ids" uuid[] DEFAULT '{}' NOT NULL,
	"loved_item_ids" uuid[] DEFAULT '{}' NOT NULL,
	"cuisine_affinity" jsonb,
	"spice_tolerance" integer,
	"cooking_skill" integer,
	"kitchen_equipment" text[] DEFAULT '{}' NOT NULL,
	"household" jsonb,
	"quality_prefs" jsonb,
	"meal_times_by_type" jsonb,
	"eats_vs_takeout_by_day" jsonb,
	"seasonality" jsonb,
	"effort_tolerance_baseline" real,
	"busy_days" text[] DEFAULT '{}' NOT NULL,
	"weekly_budget_cents" integer,
	"health_goals" text[] DEFAULT '{}' NOT NULL,
	"brand_prefs" jsonb,
	"default_retailer" "retailer" DEFAULT 'instacart' NOT NULL,
	"confidence_per_field" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"household_id" uuid,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "canonical_items" ADD CONSTRAINT "canonical_items_base_unit_id_units_of_measure_id_fk" FOREIGN KEY ("base_unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consumption_events" ADD CONSTRAINT "consumption_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consumption_events" ADD CONSTRAINT "consumption_events_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ingredient_match_overrides" ADD CONSTRAINT "ingredient_match_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ingredient_match_overrides" ADD CONSTRAINT "ingredient_match_overrides_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_from_unit_id_units_of_measure_id_fk" FOREIGN KEY ("from_unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_to_unit_id_units_of_measure_id_fk" FOREIGN KEY ("to_unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_credentials" ADD CONSTRAINT "oauth_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pantry_scan_detections" ADD CONSTRAINT "pantry_scan_detections_pantry_scan_id_pantry_scans_id_fk" FOREIGN KEY ("pantry_scan_id") REFERENCES "public"."pantry_scans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pantry_scan_detections" ADD CONSTRAINT "pantry_scan_detections_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pantry_scans" ADD CONSTRAINT "pantry_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pantry_stock" ADD CONSTRAINT "pantry_stock_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pantry_stock" ADD CONSTRAINT "pantry_stock_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "preference_signals" ADD CONSTRAINT "preference_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_package_unit_id_units_of_measure_id_fk" FOREIGN KEY ("package_unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_line_items" ADD CONSTRAINT "purchase_line_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_line_items" ADD CONSTRAINT "purchase_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_line_items" ADD CONSTRAINT "purchase_line_items_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_line_items" ADD CONSTRAINT "purchase_line_items_parsed_unit_id_units_of_measure_id_fk" FOREIGN KEY ("parsed_unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reorder_policies" ADD CONSTRAINT "reorder_policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reorder_policies" ADD CONSTRAINT "reorder_policies_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reorder_policies" ADD CONSTRAINT "reorder_policies_preferred_product_id_products_id_fk" FOREIGN KEY ("preferred_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reorder_predictions" ADD CONSTRAINT "reorder_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reorder_predictions" ADD CONSTRAINT "reorder_predictions_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_canonical_item_id_canonical_items_id_fk" FOREIGN KEY ("canonical_item_id") REFERENCES "public"."canonical_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_models" ADD CONSTRAINT "user_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "canonical_domain_idx" ON "canonical_items" USING btree ("domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "override_user_raw_idx" ON "ingredient_match_overrides" USING btree ("user_id","raw_text");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_item_idx" ON "item_unit_conversions" USING btree ("canonical_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conv_item_from_to_uq" ON "item_unit_conversions" USING btree ("canonical_item_id","from_unit_id","to_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_user_provider_uq" ON "oauth_credentials" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "detection_scan_idx" ON "pantry_scan_detections" USING btree ("pantry_scan_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pantry_user_item_uq" ON "pantry_stock" USING btree ("user_id","canonical_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prefsignal_user_idx" ON "preference_signals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_canonical_idx" ON "products" USING btree ("canonical_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_upc_idx" ON "products" USING btree ("upc");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_asin_idx" ON "products" USING btree ("asin");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lineitem_purchase_idx" ON "purchase_line_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_user_gmail_uq" ON "purchases" USING btree ("user_id","gmail_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_user_idx" ON "purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingredient_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reorder_user_item_uq" ON "reorder_policies" USING btree ("user_id","canonical_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prediction_user_idx" ON "reorder_predictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopitem_list_idx" ON "shopping_list_items" USING btree ("shopping_list_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_user_item_idx" ON "stock_ledger" USING btree ("user_id","canonical_item_id");