-- CABO R2 staging reservation and budget ledger.
-- Additive. Applied in ORDER by render-start.sh (APPLY_REVIEWED_MIGRATIONS=true),
-- inside the runner's own checksummed transaction. No user records or learner files are migrated.
CREATE TABLE IF NOT EXISTS cabo_r2_usage (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  stored_bytes bigint NOT NULL DEFAULT 0 CHECK (stored_bytes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reserved_bytes + stored_bytes <= 2147483648)
);
INSERT INTO cabo_r2_usage (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS cabo_r2_monthly_operations (
  month_utc date PRIMARY KEY,
  write_operations integer NOT NULL DEFAULT 0 CHECK (write_operations >= 0 AND write_operations <= 10000),
  read_operations integer NOT NULL DEFAULT 0 CHECK (read_operations >= 0 AND read_operations <= 50000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (date_trunc('month', month_utc::timestamp)::date = month_utc)
);

CREATE TABLE IF NOT EXISTS cabo_r2_objects (
  object_key text PRIMARY KEY,
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Authoritative institution identifier must come from server-side membership validation.
  tenant_id text NOT NULL CHECK (
    tenant_id ~ '^[a-zA-Z0-9_-]+$' AND length(tenant_id) BETWEEN 1 AND 128
  ),
  file_name varchar(512) NOT NULL CHECK (length(file_name) BETWEEN 1 AND 512),
  media_type varchar(255) NOT NULL CHECK (length(media_type) BETWEEN 1 AND 255),
  expected_sha256 char(64) NOT NULL CHECK (expected_sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 8388608),
  -- All new objects start in quarantine. Never index or serve unapproved files.
  state varchar(24) NOT NULL DEFAULT 'reserved'
    CHECK (state IN ('reserved', 'quarantined', 'approved', 'deleting', 'deleted')),
  ai_read_consent boolean NOT NULL DEFAULT false,
  -- Retain accounting category during tombstone so remote-delete acknowledgement is exact.
  billing_stage varchar(12) NOT NULL DEFAULT 'reserved' CHECK (billing_stage IN ('reserved','stored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (object_key ~ '^quarantine/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CHECK (state NOT IN ('quarantined','approved') OR billing_stage = 'stored')
);
CREATE INDEX IF NOT EXISTS cabo_r2_objects_owner_tenant_state_idx
  ON cabo_r2_objects(owner_user_id, tenant_id, state);
CREATE INDEX IF NOT EXISTS cabo_r2_objects_expiry_idx
  ON cabo_r2_objects(expires_at)
  WHERE state = 'reserved';

COMMENT ON TABLE cabo_r2_usage IS
  'Enforced staging-only 2 GiB object capacity, counting persisted and pending objects.';
COMMENT ON TABLE cabo_r2_objects IS
  'Tenant-scoped private staging upload reservations; no direct public R2 URLs. Cleanup must confirm object deletion before decrementing usage.';

