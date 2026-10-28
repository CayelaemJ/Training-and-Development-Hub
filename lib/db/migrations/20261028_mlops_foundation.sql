-- Tenant-isolated MLOps registry and aggregate evaluation records.
-- Operational rows intentionally omit learner IDs, free text, prompts, answers, and arbitrary JSON metadata.
-- Validate on the isolated Neon test branch before enabling ENABLE_MLOPS_REGISTRY.
CREATE TABLE IF NOT EXISTS ml_model_versions (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_key varchar(100) NOT NULL,
  version varchar(100) NOT NULL,
  provider varchar(80) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'shadow',
  approved_by varchar(120) REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ml_model_versions_status_check CHECK (status IN ('shadow', 'approved', 'paused', 'retired')),
  CONSTRAINT ml_model_versions_provider_check CHECK (provider IN ('groq', 'openai', 'huggingface')),
  CONSTRAINT ml_model_versions_key_check CHECK (model_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
  CONSTRAINT ml_model_versions_version_check CHECK (version ~ '^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,99}$'),
  CONSTRAINT ml_model_version_unique UNIQUE (organization_id, model_key, version),
  CONSTRAINT ml_model_versions_id_org_unique UNIQUE (id, organization_id)
);

CREATE INDEX IF NOT EXISTS ml_model_versions_lookup
  ON ml_model_versions (organization_id, model_key, status);

CREATE TABLE IF NOT EXISTS ml_evaluation_runs (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_version_id integer NOT NULL,
  domain varchar(40) NOT NULL,
  sample_count integer NOT NULL,
  mean_absolute_error real,
  normalized_mean_absolute_error real,
  agreement_rate real,
  human_review_rate real,
  passed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ml_eval_model_version_org_fk
    FOREIGN KEY (model_version_id, organization_id)
    REFERENCES ml_model_versions (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT ml_eval_sample_count_check CHECK (sample_count BETWEEN 0 AND 500),
  CONSTRAINT ml_eval_domain_check CHECK (domain = 'academic_grading'),
  CONSTRAINT ml_eval_metrics_range_check CHECK (
    (mean_absolute_error IS NULL OR mean_absolute_error BETWEEN 0 AND 1000)
    AND (normalized_mean_absolute_error IS NULL OR normalized_mean_absolute_error BETWEEN 0 AND 1)
    AND (agreement_rate IS NULL OR agreement_rate BETWEEN 0 AND 1)
    AND (human_review_rate IS NULL OR human_review_rate BETWEEN 0 AND 1)
  )
);

CREATE INDEX IF NOT EXISTS ml_eval_tenant_date
  ON ml_evaluation_runs (organization_id, created_at);

CREATE TABLE IF NOT EXISTS ml_operational_events (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_key varchar(100) NOT NULL,
  version varchar(100) NOT NULL,
  event_type varchar(40) NOT NULL,
  duration_ms integer,
  token_count integer,
  estimated_cost_usd real,
  status varchar(25) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ml_ops_event_type_check CHECK (event_type IN ('grading', 'evaluation')),
  CONSTRAINT ml_ops_status_check CHECK (status IN ('success', 'failure', 'timeout')),
  CONSTRAINT ml_ops_duration_check CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 900000),
  CONSTRAINT ml_ops_token_count_check CHECK (token_count IS NULL OR token_count BETWEEN 0 AND 1000000),
  CONSTRAINT ml_ops_cost_check CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd BETWEEN 0 AND 1000)
);

CREATE INDEX IF NOT EXISTS ml_ops_tenant_date
  ON ml_operational_events (organization_id, created_at);
