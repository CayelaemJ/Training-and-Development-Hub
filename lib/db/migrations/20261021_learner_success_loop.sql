CREATE TABLE IF NOT EXISTS education_framework_versions (
 id serial PRIMARY KEY, organization_id integer NOT NULL REFERENCES organizations(id),
 country_code varchar(2) NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'), framework_code varchar(80) NOT NULL,
 name varchar(200) NOT NULL, time_zone varchar(80) NOT NULL, languages jsonb NOT NULL, settings jsonb NOT NULL,
 created_by varchar NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS education_framework_current ON education_framework_versions(organization_id,id);
-- Additive migration. Apply with scripts/migrate-learner-support.mjs; never schema-push production.
CREATE TABLE IF NOT EXISTS learner_support_tickets (
 id serial PRIMARY KEY, organization_id integer NOT NULL REFERENCES organizations(id),
 course_id integer NOT NULL REFERENCES academic_courses(id), learner_id varchar NOT NULL REFERENCES users(id),
 framework_version_id integer REFERENCES education_framework_versions(id),
 concept varchar(160) NOT NULL, question text NOT NULL, attempted text NOT NULL,
 status varchar(32) NOT NULL DEFAULT 'open' CHECK(status IN ('open','triaged','assigned','in_progress','awaiting_learner','follow_up_required','resolved','closed')),
 assigned_to varchar REFERENCES users(id), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 request_key varchar(80) NOT NULL, baseline_grade_id integer REFERENCES academic_grades(id),
 followup_grade_id integer REFERENCES academic_grades(id), outcome jsonb,
 feedback varchar(24) CHECK(feedback IS NULL OR feedback IN ('helpful','needs_more_help')),
 review_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS support_request_idempotency ON learner_support_tickets(learner_id,request_key);
CREATE INDEX IF NOT EXISTS support_org_queue ON learner_support_tickets(organization_id,status,id);
CREATE INDEX IF NOT EXISTS support_learner_timeline ON learner_support_tickets(learner_id,organization_id,id);
CREATE INDEX IF NOT EXISTS support_assignee_queue ON learner_support_tickets(assigned_to,status,id);
CREATE TABLE IF NOT EXISTS learner_support_events (
 id serial PRIMARY KEY, ticket_id integer NOT NULL REFERENCES learner_support_tickets(id),
 actor_id varchar NOT NULL REFERENCES users(id), kind varchar(32) NOT NULL, body text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_event_timeline ON learner_support_events(ticket_id,id);
