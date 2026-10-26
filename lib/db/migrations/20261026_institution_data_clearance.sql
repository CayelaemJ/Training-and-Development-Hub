-- Separate from country classification. Run only after schema review and
-- disposable staging backup/restore; do not infer live school approval.
CREATE TABLE IF NOT EXISTS institution_data_clearances (
 organization_id integer PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 country_code varchar(2) NOT NULL CHECK(country_code IN ('ZA','BW')),
 state varchar(16) NOT NULL DEFAULT 'blocked' CHECK(state IN ('blocked','approved','revoked')),
 evidence_reference text NOT NULL CHECK(length(trim(evidence_reference)) > 0),
 authorised_by varchar NOT NULL REFERENCES users(id),
 approved_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT valid_data_clearance_expiry CHECK(expires_at > approved_at)
);
-- Intentionally no approved rows and no automated way for institutions to
-- approve themselves. Legal/operations owner must verify evidence out of band.
