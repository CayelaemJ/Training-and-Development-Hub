ALTER TABLE ai_inference_metrics
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd real;

DO $$ BEGIN
  ALTER TABLE ai_inference_metrics ADD CONSTRAINT ai_inference_metrics_token_check
    CHECK (input_tokens IS NULL OR input_tokens BETWEEN 0 AND 1000000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ai_inference_metrics ADD CONSTRAINT ai_inference_metrics_output_token_check
    CHECK (output_tokens IS NULL OR output_tokens BETWEEN 0 AND 1000000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ai_inference_metrics ADD CONSTRAINT ai_inference_metrics_cost_check
    CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd BETWEEN 0 AND 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS client_platform_heartbeats (
  id serial PRIMARY KEY,
  platform varchar(16) NOT NULL CHECK (platform IN ('web', 'ios', 'android', 'windows')),
  version varchar(40) NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_http_status integer NOT NULL DEFAULT 200 CHECK (last_http_status BETWEEN 100 AND 599),
  CONSTRAINT client_platform_heartbeats_platform_version_unique UNIQUE (platform, version)
);
CREATE INDEX IF NOT EXISTS client_platform_heartbeats_last_seen_idx
  ON client_platform_heartbeats (platform, last_seen_at);
