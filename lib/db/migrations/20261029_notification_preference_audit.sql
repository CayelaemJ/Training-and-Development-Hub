-- Depends on notification_preferences and notification_outbox migrations.
-- Review-only: do not run against the live CABO Neon database automatically.
CREATE TABLE IF NOT EXISTS notification_preference_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL CHECK (kind IN ('guardian_review_requested','learner_support_updated')),
  action VARCHAR(12) NOT NULL CHECK (action IN ('opt_in','opt_out')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notification_preference_events_user_idx
  ON notification_preference_events(user_id,organization_id,created_at);
-- Contains only the consenting user's account ID, school ID, kind and action.
