-- Parent "new results published" notices (owner request 2026-11-22).
--
-- Additive: widens four CHECK constraints so the existing consented outbox can
-- carry one more notice kind and source kind. No rows are changed, nobody is
-- opted in, and nothing is sent by this migration. Guardians must opt in per
-- school with a verified sign-in, and every send is re-authorized live.
--
-- Rollback (only if no results_published rows exist):
--   restore the previous CHECK lists shown in each DROP below.
ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_outbox_kind_check
  CHECK (kind IN ('guardian_review_requested','learner_support_updated','results_published','account_security'));
ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_kind_check;
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_kind_check
  CHECK (kind IN ('guardian_review_requested','learner_support_updated','results_published','account_security'));
ALTER TABLE notification_preference_events DROP CONSTRAINT IF EXISTS notification_preference_events_kind_check;
ALTER TABLE notification_preference_events ADD CONSTRAINT notification_preference_events_kind_check
  CHECK (kind IN ('guardian_review_requested','learner_support_updated','results_published'));
ALTER TABLE notification_event_sources DROP CONSTRAINT IF EXISTS notification_event_sources_source_kind_check;
ALTER TABLE notification_event_sources ADD CONSTRAINT notification_event_sources_source_kind_check
  CHECK (source_kind IN ('support_ticket','guardian_relationship','academic_grade'));
