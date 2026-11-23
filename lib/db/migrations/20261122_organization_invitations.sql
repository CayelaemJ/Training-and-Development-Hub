-- Consent-based organization membership invitations.
--
-- Additive only: creates one new table and its indexes. Existing
-- organization_members rows are untouched, so current members keep access.
--
-- Invitations are keyed by the normalized email that a manager typed, not by
-- a resolved user id. Managers therefore see the same pending entry whether or
-- not that email belongs to an account, which removes the account-existence
-- oracle that direct email-to-member insertion created. A membership row is
-- created only when the account holder for that email accepts.
--
-- Rollback (only if no invitation data needs keeping):
--   DROP TABLE IF EXISTS organization_invitations;
CREATE TABLE IF NOT EXISTS organization_invitations (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  role varchar(24) NOT NULL,
  invited_by varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  responded_at timestamptz,
  responded_by varchar REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT organization_invitations_role CHECK (role IN ('admin','teacher','assessor','learner')),
  CONSTRAINT organization_invitations_status CHECK (status IN ('pending','accepted','declined','revoked')),
  CONSTRAINT organization_invitations_email_normalized CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 320 AND position('@' in email) > 1),
  CONSTRAINT organization_invitations_expiry CHECK (expires_at > created_at),
  CONSTRAINT organization_invitations_response CHECK ((status = 'pending') = (responded_at IS NULL))
);
-- At most one open invitation per organization and email.
CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_open_idx
  ON organization_invitations (organization_id, email) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS organization_invitations_email_idx
  ON organization_invitations (email) WHERE status = 'pending';
