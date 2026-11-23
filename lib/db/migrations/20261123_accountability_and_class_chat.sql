-- Accountability cases with escalation, and teacher-moderated class chat.
--
-- Additive only: six new tables, their indexes, CHECKs and one trigger.
-- Existing tables and rows are untouched.
--
-- accountability_case_events is append-only: the trigger refuses UPDATE so
-- the record of who did what, and which deadlines were missed, cannot be
-- rewritten. Rows are removed only when their case (and so their school) is
-- deleted.
--
-- Rollback (only if no case or chat data needs keeping):
--   DROP TABLE IF EXISTS class_chat_mutes, class_chat_reports, class_chat_messages,
--     class_chat_channels, accountability_case_events, accountability_cases;
--   DROP FUNCTION IF EXISTS accountability_case_events_append_only();
CREATE TABLE IF NOT EXISTS accountability_cases (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind varchar(24) NOT NULL CHECK (kind IN ('safeguarding','conduct','data_incident','chat_report','service')),
  severity varchar(12) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status varchar(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','in_progress','resolved','closed')),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 10 AND 2000),
  reporter_id varchar REFERENCES users(id) ON DELETE SET NULL,
  subject_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  assigned_to varchar REFERENCES users(id) ON DELETE SET NULL,
  escalation_level integer NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 2),
  jurisdiction varchar(5) NOT NULL CHECK (jurisdiction IN ('ZA','BW','UNSET')),
  aware_at timestamptz NOT NULL DEFAULT now(),
  acknowledge_due_at timestamptz NOT NULL,
  resolve_due_at timestamptz NOT NULL,
  regulator_due_at timestamptz,
  regulator_notified_at timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  source_message_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accountability_owner_not_subject CHECK (assigned_to IS NULL OR subject_user_id IS NULL OR assigned_to <> subject_user_id),
  CONSTRAINT accountability_regulator_only_incidents CHECK (kind = 'data_incident' OR (regulator_due_at IS NULL AND regulator_notified_at IS NULL)),
  CONSTRAINT accountability_closed_after_resolved CHECK (status <> 'closed' OR resolved_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS accountability_cases_org_status_idx ON accountability_cases (organization_id, status);
CREATE INDEX IF NOT EXISTS accountability_cases_assignee_idx ON accountability_cases (assigned_to);
CREATE INDEX IF NOT EXISTS accountability_cases_reporter_idx ON accountability_cases (reporter_id);

CREATE TABLE IF NOT EXISTS accountability_case_events (
  id serial PRIMARY KEY,
  case_id integer NOT NULL REFERENCES accountability_cases(id) ON DELETE CASCADE,
  organization_id integer NOT NULL,
  actor_id varchar,
  action varchar(24) NOT NULL CHECK (action IN ('created','assigned','no_owner','acknowledge','start','resolve','close','reopen','note','escalated','overdue_at_top','regulator_notified')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  from_level integer,
  to_level integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accountability_case_events_case_idx ON accountability_case_events (case_id, id);

CREATE OR REPLACE FUNCTION accountability_case_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'accountability_case_events is append-only';
END $$;
DROP TRIGGER IF EXISTS accountability_case_events_no_update ON accountability_case_events;
CREATE TRIGGER accountability_case_events_no_update BEFORE UPDATE ON accountability_case_events
  FOR EACH ROW EXECUTE FUNCTION accountability_case_events_append_only();

CREATE TABLE IF NOT EXISTS class_chat_channels (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES academic_courses(id) ON DELETE CASCADE,
  status varchar(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by varchar NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS class_chat_channels_course_idx ON class_chat_channels (course_id);

CREATE TABLE IF NOT EXISTS class_chat_messages (
  id serial PRIMARY KEY,
  channel_id integer NOT NULL REFERENCES class_chat_channels(id) ON DELETE CASCADE,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id varchar REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  status varchar(12) NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','held','hidden')),
  screen_reason varchar(40),
  moderated_by varchar REFERENCES users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  moderation_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS class_chat_messages_channel_idx ON class_chat_messages (channel_id, id);
CREATE INDEX IF NOT EXISTS class_chat_messages_author_idx ON class_chat_messages (author_id, created_at);

CREATE TABLE IF NOT EXISTS class_chat_reports (
  id serial PRIMARY KEY,
  message_id integer NOT NULL REFERENCES class_chat_messages(id) ON DELETE CASCADE,
  reporter_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason varchar(24) NOT NULL CHECK (reason IN ('bullying','unsafe_contact','inappropriate','self_harm_concern','spam','other')),
  case_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS class_chat_reports_once_idx ON class_chat_reports (message_id, reporter_id);

CREATE TABLE IF NOT EXISTS class_chat_mutes (
  channel_id integer NOT NULL REFERENCES class_chat_channels(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_by varchar NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
