-- Separate from country classification. Run only after schema review and
-- disposable staging backup/restore; do not infer live school approval.
CREATE TABLE IF NOT EXISTS institution_data_clearances (
 organization_id integer PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 country_code varchar(2) NOT NULL CHECK(country_code IN ('ZA','BW')),
 state varchar(16) NOT NULL DEFAULT 'blocked' CHECK(state IN ('blocked','approved','revoked')),
 evidence_reference text NOT NULL CHECK(length(trim(evidence_reference)) > 0),
 transfer_state varchar(24) NOT NULL DEFAULT 'unreviewed'
   CHECK(transfer_state IN ('unreviewed','no_transfer','approved_transfer')),
 transfer_assessment_reference text NOT NULL,
 botswana_local_copy_reference text,
 botswana_local_copy_verified_at timestamptz,
 authorised_by varchar NOT NULL REFERENCES users(id),
 approved_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT valid_data_clearance_expiry CHECK(expires_at > approved_at),
 CONSTRAINT approved_transfer_reviewed CHECK(
   state <> 'approved' OR
   (transfer_state <> 'unreviewed' AND length(trim(transfer_assessment_reference)) > 0)
 ),
 CONSTRAINT botswana_export_requires_local_copy CHECK(
   state <> 'approved' OR country_code <> 'BW' OR transfer_state <> 'approved_transfer' OR
   (length(trim(coalesce(botswana_local_copy_reference,''))) > 0
    AND botswana_local_copy_verified_at IS NOT NULL)
 )
);
-- Intentionally no approved rows and no automated way for institutions to
-- approve themselves. Legal/operations owner must verify evidence out of band.
