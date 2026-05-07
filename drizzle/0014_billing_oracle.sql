-- Migration: billing oracle - ETH/USD snapshots, trusted pipeline/model attribution,
-- usage billing events, plan USD allowance fields, and price oracle snapshots table.
-- Each statement is separated by a breakpoint comment so drizzle-kit migrate can
-- run them atomically or individually depending on the driver mode.

--> statement-breakpoint
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "pipeline" text,
  ADD COLUMN IF NOT EXISTS "model_id" text,
  ADD COLUMN IF NOT EXISTS "attribution_source" text,
  ADD COLUMN IF NOT EXISTS "gateway_request_id" text,
  ADD COLUMN IF NOT EXISTS "payment_metadata_version" text,
  ADD COLUMN IF NOT EXISTS "pipeline_model_constraint_hash" text,
  ADD COLUMN IF NOT EXISTS "advertised_price_wei_per_unit" text,
  ADD COLUMN IF NOT EXISTS "advertised_pixels_per_unit" text,
  ADD COLUMN IF NOT EXISTS "signed_price_wei_per_unit" text,
  ADD COLUMN IF NOT EXISTS "signed_pixels_per_unit" text,
  ADD COLUMN IF NOT EXISTS "price_validation_status" text,
  ADD COLUMN IF NOT EXISTS "price_validation_reason" text,
  ADD COLUMN IF NOT EXISTS "eth_usd_price" text,
  ADD COLUMN IF NOT EXISTS "eth_usd_source" text,
  ADD COLUMN IF NOT EXISTS "eth_usd_observed_at" text,
  ADD COLUMN IF NOT EXISTS "network_fee_usd_micros" text,
  ADD COLUMN IF NOT EXISTS "owner_platform_fee_wei" text,
  ADD COLUMN IF NOT EXISTS "owner_platform_fee_usd_micros" text,
  ADD COLUMN IF NOT EXISTS "owner_charge_wei" text,
  ADD COLUMN IF NOT EXISTS "owner_charge_usd_micros" text;

--> statement-breakpoint
ALTER TABLE "plans"
  ADD COLUMN IF NOT EXISTS "included_usd_micros" text,
  ADD COLUMN IF NOT EXISTS "general_upcharge_percent_bps" integer,
  ADD COLUMN IF NOT EXISTS "pay_per_use_upcharge_percent_bps" integer,
  ADD COLUMN IF NOT EXISTS "billing_cycle" text NOT NULL DEFAULT 'monthly';

--> statement-breakpoint
ALTER TABLE "plan_capability_bundles"
  ADD COLUMN IF NOT EXISTS "upcharge_percent_bps" integer;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_oracle_snapshots" (
  "id" text PRIMARY KEY,
  "symbol" text NOT NULL,
  "price_usd" text NOT NULL,
  "source" text NOT NULL,
  "fetched_at" text NOT NULL,
  "created_at" text NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_oracle_snapshots_symbol_fetched_at"
  ON "price_oracle_snapshots" ("symbol", "fetched_at");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_billing_events" (
  "id" text PRIMARY KEY,
  "usage_record_id" text,
  "transaction_id" text,
  "stream_session_id" text,
  "client_id" text NOT NULL,
  "user_id" text,
  "plan_id" text,
  "subscription_id" text,
  "pipeline" text NOT NULL,
  "model_id" text NOT NULL,
  "attribution_source" text NOT NULL,
  "gateway_request_id" text,
  "payment_metadata_version" text,
  "pipeline_model_constraint_hash" text NOT NULL,
  "orch_address" text,
  "advertised_price_wei_per_unit" text NOT NULL,
  "advertised_pixels_per_unit" text NOT NULL,
  "signed_price_wei_per_unit" text NOT NULL,
  "signed_pixels_per_unit" text NOT NULL,
  "network_fee_wei" text NOT NULL,
  "network_fee_usd_micros" text NOT NULL,
  "platform_fee_wei" text NOT NULL,
  "platform_fee_usd_micros" text NOT NULL,
  "owner_charge_wei" text NOT NULL,
  "owner_charge_usd_micros" text NOT NULL,
  "upcharge_percent_bps" integer NOT NULL DEFAULT 0,
  "pricing_rule_source" text NOT NULL DEFAULT 'unpriced',
  "end_user_billable_usd_micros" text NOT NULL DEFAULT '0',
  "eth_usd_price" text NOT NULL,
  "eth_usd_source" text NOT NULL,
  "eth_usd_observed_at" text NOT NULL,
  "created_at" text NOT NULL
);

--> statement-breakpoint
ALTER TABLE "usage_billing_events"
  ADD CONSTRAINT "usage_billing_events_client_id_developer_apps_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "public"."developer_apps"("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_usage_billing_events_usage_record_id"
  ON "usage_billing_events" ("usage_record_id")
  WHERE "usage_record_id" IS NOT NULL;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usage_billing_events_client_created_at"
  ON "usage_billing_events" ("client_id", "created_at");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usage_billing_events_client_user_created_at"
  ON "usage_billing_events" ("client_id", "user_id", "created_at");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usage_billing_events_client_pipeline_model_created_at"
  ON "usage_billing_events" ("client_id", "pipeline", "model_id", "created_at");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usage_billing_events_stream_session_created_at"
  ON "usage_billing_events" ("stream_session_id", "created_at");
