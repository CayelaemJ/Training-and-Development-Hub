-- Review and apply in a staged environment before CABO_NATIVE_AUTH_ENABLED=true.
-- Additive schema; existing browser sessions and users are untouched.
CREATE TABLE IF NOT EXISTS native_auth_codes (
  code_hash varchar(64) PRIMARY KEY,
  client_id varchar(64) NOT NULL,
  user_id varchar(255) NOT NULL,
  challenge varchar(43) NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_native_auth_codes_expires ON native_auth_codes(expires_at);
-- Operational cleanup, run periodically with your existing scheduled DB worker:
-- DELETE FROM native_auth_codes WHERE expires_at < now() - interval '1 day';
