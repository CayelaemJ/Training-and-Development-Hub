-- Additive ONLY. Do not apply to a real school database before legal,
-- encrypted-recipient retention, key-management and synthetic rollback review.
CREATE TABLE IF NOT EXISTS notification_outbox (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  organization_id INTEGER,
  recipient_user_id VARCHAR(128) NOT NULL,
  recipient_ciphertext TEXT NOT NULL,
  kind VARCHAR(40) NOT NULL CHECK (kind IN ('guardian_review_requested','learner_support_updated','account_security')),
  status VARCHAR(24) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','leased','sent','needs_review')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 3),
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  error_code VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON notification_outbox(status,created_at);
CREATE INDEX IF NOT EXISTS notification_outbox_user_idx
  ON notification_outbox(recipient_user_id,created_at);
-- No queue worker or secret is enabled by this migration.
