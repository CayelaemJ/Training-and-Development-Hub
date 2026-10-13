# Sports, extracurricular development and coach intelligence

## Product commitment
Sport, arts, culture, debate, chess, community service and leadership are first-class development domains alongside academics. Success is not a universal numerical score; each domain has age-appropriate, evidence-based measurements and includes enjoyment, participation, improvement and access.

## Current incremental implementation
The /sports-development page is a responsive discovery page, included in authorised parent, learner, teacher, headmaster and superadmin navigation. It deliberately does not create unverifiable sporting profiles or expose learner data. The existing My journey milestones system is available for private self-reported general milestones.

## Next-phase capabilities
1. Activities catalog by institution and season: sport, arts, community, club, cultural, leadership and other.
2. Team/squad roster, season, coach assignment, age group, positions/disciplines and training timetable.
3. Learner participation records, attendance, competitions, performances, achievements, evidence and provenance.
4. Assessment rubric per activity, age band and level with coach-evaluated skill dimensions, baseline/goal/date and optional learner reflection.
5. Progress intelligence showing dated longitudinal changes for each rubric dimension, participation trends and goals; flag sparse data rather than infer ability.
6. Coach console to manage assigned rosters, record observations, approve results, review individual development plans and communicate through protected institution-managed channels.
7. Guardian view showing only verified linked children's approved observations, with supportive next steps.
8. Enrichment passport integrated with the learner's academic learning journey without mixing unrelated measurements into a single ranking.

## Database design proposal (not implemented)
- extracurricular_activities(id, organization_id, domain, name, season, visibility)
- extracurricular_teams(id, activity_id, name, level, age_band, year, owner_coach_id)
- extracurricular_coach_assignments(id, team_id, coach_user_id, role, verified_at)
- extracurricular_memberships(id, team_id, learner_id, joined_at, departed_at, status)
- extracurricular_sessions(id, team_id, start_at, end_at, venue)
- extracurricular_participation(id, session_id, learner_id, status, recorded_by, recorded_at)
- extracurricular_rubrics(id, activity_id, level, version, criteria_json, published_at)
- extracurricular_observations(id, learner_id, team_id, rubric_id, criterion_key, score, evidence, observer_id, observed_at, verification_status)
- extracurricular_achievements(id, learner_id, team_id, event_name, achievement, date, provenance, verified_by)
- extracurricular_goals(id, learner_id, domain, criterion_key, baseline, target, review_date, coach_owner_id, status)
- extracurricular_audit_events(id, actor_id, resource, resource_id, change_summary, created_at)

Use existing users, organizations, institution enrolments and authorised guardian relationships. Index team_id+learner_id, learner_id+observed_at, school/season, and unique membership identities. Use reviewed migrations, not a development push on production.

## Coach intelligence
- Comparative trend is **within the same learner**, rubric version and activity; never compare incomparable sports or grade-level differences.
- Offer progress graphs, training consistency, coach notes and actionable practice recommendations based on observable evidence.
- Allow coaches to override and explain observations; distinguish coach-verified from self-reported records.
- Do not infer a child's mental or physical health, produce injury diagnoses, assert predictive elite-sport potential, or automatically deny opportunities.
- Ensure rest and learner choice are visible; no algorithmic pressure to train excessively.

## Authorization and child privacy
- Default private for minors. Server enforce parent-child link, membership, assigned-coach and tenant checks for every route.
- Coach cannot browse other school teams; team-assigned permission is necessary even for school staff.
- Publish achievements externally only with separately documented, revocable permission and safe publicity controls.
- Avoid storage of sensitive health data, biometric measurements or precise whereabouts unless absolutely necessary, appropriately governed and separately approved.
- Minimize data retention, protect attachments, provide export/correction/deletion flows and audit access.
- Verify South African POPIA/children's information requirements with qualified counsel before live pilots.

## Future route sketches (NOT IMPLEMENTED)
- GET /api/extracurricular/me/portfolio
- GET /api/extracurricular/guardian/children/:learnerId
- GET /api/extracurricular/coaches/me/teams
- POST /api/extracurricular/teams/:teamId/observations
- GET /api/extracurricular/learners/:learnerId/progress?activityId=...
- POST /api/extracurricular/achievements/:achievementId/verify

## Delivery gates
- Define migrations, typed contracts and institution-scoped authorization middleware.
- Build coach roster and assessment workflows; create guardian-approved sharing controls.
- Verify permission isolation with learner, guardian, coach and cross-institution test accounts.
- Run typecheck/build, run mobile interaction tests and confirm slow-network behavior.
- Pilot with one school and at least two unrelated extracurricular disciplines before proposing a broad skill-comparison model.
