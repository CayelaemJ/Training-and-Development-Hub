-- Additive, review on a dedicated CABO pilot Neon database before enabling.
-- Existing web submissions remain valid with request_key NULL.
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS request_key varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_attempts_user_request_key
  ON quiz_attempts (user_id, request_key)
  WHERE request_key IS NOT NULL;

-- Deployment order: apply and verify this migration, then enable
-- CABO_QUIZ_IDEMPOTENCY_ENABLED=true on the isolated API pilot.
-- Do not apply this migration to a live school database without approval.
