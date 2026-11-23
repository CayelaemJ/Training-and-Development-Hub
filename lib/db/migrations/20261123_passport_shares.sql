-- Learner-approved, revocable, time-limited passport shares with one
-- university, college or employer, plus a view log. Additive: new tables only.
-- Applied in ORDER by render-start.sh, inside the runner's own transaction.
CREATE TABLE IF NOT EXISTS passport_shares (
  id serial PRIMARY KEY,
  learner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purpose varchar(20) NOT NULL,
  scope jsonb NOT NULL,
  status varchar(20) NOT NULL,
  guardian_id varchar REFERENCES users(id) ON DELETE SET NULL,
  guardian_decided_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT passport_shares_status_check CHECK (status IN ('pending_guardian','active','declined','revoked')),
  CONSTRAINT passport_shares_purpose_check CHECK (purpose IN ('admission','bursary','employment','internship'))
);
CREATE INDEX IF NOT EXISTS passport_shares_learner_idx ON passport_shares(learner_id, created_at);
CREATE INDEX IF NOT EXISTS passport_shares_recipient_idx ON passport_shares(organization_id, status);

CREATE TABLE IF NOT EXISTS passport_share_views (
  id serial PRIMARY KEY,
  share_id integer NOT NULL REFERENCES passport_shares(id) ON DELETE CASCADE,
  viewer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_share_views_share_idx ON passport_share_views(share_id, viewed_at);
