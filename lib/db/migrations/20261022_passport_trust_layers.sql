-- Additive successor to 20261022_lifelong_passport_foundation.
-- Layer 1: passport_competencies; Layer 2: AI interpretation; Layer 3: human institution review.
CREATE TABLE IF NOT EXISTS passport_ai_interpretations (
 id serial PRIMARY KEY,
 user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 competency_id integer NOT NULL REFERENCES passport_competencies(id) ON DELETE CASCADE,
 summary text NOT NULL,
 practice_suggestion text NOT NULL,
 limitations text NOT NULL,
 model_id varchar(160) NOT NULL,
 prompt_version varchar(40) NOT NULL,
 source_digest varchar(64) NOT NULL,
 review_state varchar(20) NOT NULL DEFAULT 'unreviewed' CHECK(review_state IN ('unreviewed','noted','disputed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_ai_user_idx ON passport_ai_interpretations(user_id,created_at);
CREATE TABLE IF NOT EXISTS passport_achievement_reviews (
 id serial PRIMARY KEY,
 user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 competency_id integer NOT NULL REFERENCES passport_competencies(id) ON DELETE CASCADE,
 status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected','revoked')),
 reviewer_id varchar REFERENCES users(id) ON DELETE SET NULL,
 review_note text,
 reviewed_at timestamptz,
 revoked_by varchar REFERENCES users(id) ON DELETE SET NULL,
 revoked_at timestamptz,
 revoke_reason text,
 requested_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT passport_human_verification_required CHECK(
  status <> 'verified' OR
  (reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL
   AND length(trim(review_note)) >= 20 AND reviewer_id <> user_id)
 )
);
CREATE INDEX IF NOT EXISTS passport_review_owner_idx ON passport_achievement_reviews(user_id,requested_at);
CREATE INDEX IF NOT EXISTS passport_review_org_queue_idx ON passport_achievement_reviews(organization_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS passport_review_active_unique ON passport_achievement_reviews(organization_id,competency_id) WHERE status IN ('pending','verified');
CREATE TABLE IF NOT EXISTS passport_achievement_audit (
 id serial PRIMARY KEY,
 review_id integer NOT NULL REFERENCES passport_achievement_reviews(id) ON DELETE CASCADE,
 actor_id varchar NOT NULL REFERENCES users(id),
 action varchar(20) NOT NULL CHECK(action IN ('requested','verified','rejected','revoked')),
 explanation text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_review_audit_idx ON passport_achievement_audit(review_id,id);
