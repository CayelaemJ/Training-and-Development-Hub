-- CABO notification eligibility: additive, review-only. DO NOT apply to
-- live learner databases before the parent/guardian consent review.
-- Requires the previously reviewed notification_outbox migration first.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL
    CHECK (kind IN ('guardian_review_requested','learner_support_updated','account_security')),
  opted_in BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id,organization_id,kind),
  CONSTRAINT notification_consent_consistency CHECK (
    NOT opted_in OR (confirmed_at IS NOT NULL AND revoked_at IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS notification_preferences_org_idx
  ON notification_preferences(organization_id,kind);
CREATE TABLE IF NOT EXISTS notification_event_sources (
  event_id UUID PRIMARY KEY REFERENCES notification_outbox(event_id) ON DELETE CASCADE,
  source_kind VARCHAR(32) NOT NULL
    CHECK (source_kind IN ('support_ticket','guardian_relationship')),
  source_id INTEGER NOT NULL CHECK (source_id>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notification_source_lookup_idx
  ON notification_event_sources(source_kind,source_id);
-- No users are opted in and no messages are sent by this migration.
