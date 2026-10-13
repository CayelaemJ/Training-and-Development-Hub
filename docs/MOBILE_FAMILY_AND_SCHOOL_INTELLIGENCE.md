# CABO Learning Hub — Family Mobile Experience and School Intelligence

## Delivered in this branch
- Parent and learner portals gain a compact, role-aware mobile bottom navigation.
- Every allowed portal screen remains reachable from an accessible More menu.
- Bottom navigation respects iOS safe-area insets, remains separate from the desktop sidebar, and highlights the active screen.
- Small-screen improvements for heading actions, form touch sizing, responsive imagery and wide tables.
- This is a navigation/responsiveness increment, **not** a claim that attendance, guardian insights or national rankings are operational.

## Next development increments

### A. Parent assurance dashboard
- Only verified guardian-child links can return individual learner data. Enforce checks server-side on every request.
- Per-child switcher, last **verified** attendance state with timestamp and source, outstanding work, published subject marks, next class and teacher communications.
- Honest missing-data states: never display a green check-in or mark merely because no data arrived.
- Summaries should distinguish *submitted*, *teacher reviewed*, *published*, and *overdue*.
- Optional guardian notification preferences and quiet hours, with rate-limited batched updates.

### B. Learner daily cockpit
- Today's timetable, assignment checklist, next subject, revision plan and subject-level trend.
- Acknowledge progress without attaching stigmatizing labels to minors or assigning deterministic future outcomes.
- Cached timetable and already-authorized read-only material can be used offline; grade and attendance records must refresh when online.

### C. Timetables and attendance
- Schools, terms, grade/class group, subjects, rooms, staff, exception days, lesson slots.
- Attendance events store event time, captured time, actor, source, review status and audit event.
- A school IP allowlist may be used as *one weak contextual indicator*, never as proof of physical presence: NAT, VPNs, cellular networks, shared Wi-Fi and device borrowing cause false positives.
- Suggested check-in: institution-controlled rotating QR or authenticated school kiosk, with optional network evidence and teacher confirmation. Allow manual correction with reasons.
- Show unverified/pending check-in distinct from verified present, late, authorised absent and unexcused absent. Retain appeals and correction logs.
- Do not continuously track pupil location or collect unnecessary raw IP histories.

### D. Report cards, improvement and promotions
- Versioned school-approved academic policies per grade, period, subject and assessment type.
- Weighted scores only from published, moderated marks. Treat missing scores as incomplete, not zero by default.
- Generated reports require school sign-off and carry publication/version dates; PDFs only after approval.
- Improvement targets use specific curriculum topics, evidence-based gaps, recommended practice, teacher review and reassessment.
- Promotion decisions are **human approved** and must follow the institution's applicable current regulations. Never automatically certify progression based only on AI scores.

### E. Achievement and rankings
- School top-ten only across a comparable cohort, term and validated assessment scheme.
- Province/national rankings require explicit participating institutions, common moderation standards and enough comparable participants. Never label synthetic or incomplete cohorts as actual provincial/national results.
- Minors' ranking profiles are private by default. For public recognition use opt-in, guardian approval where necessary, pseudonyms/aggregate statistics and opt-out; avoid disclosing marks or attendance.
- Add anti-gaming, duplicate learner reconciliation, tie handling and provenance.

## Suggested data entities
TimetableSlot, TimetableException, AttendanceEvent, AttendanceReview, GuardianLearnerAccess, AcademicReport, AcademicReportPublication, PromotionDecision, ImprovementGoal, CurriculumSkillEvidence, RankingCohort, RankingPublication, NotificationPreference, NotificationDelivery.

## API contract sketch (not yet implemented)
- GET /api/family/children
- GET /api/family/children/:learnerId/overview
- GET /api/learners/me/today
- GET /api/learners/me/improvement
- GET /api/attendance/me?date=YYYY-MM-DD
- POST /api/schools/:id/attendance/check-ins
- POST /api/schools/:id/attendance/:eventId/review
- GET /api/learners/me/reports
- GET /api/schools/:id/rankings?cohort=...

All endpoints must enforce role, tenant, institution and child ownership on the server with structured audit events.

## Validation and release gates
1. Run `pnpm run typecheck && pnpm run build`.
2. Check 320px, 375px, 390px, 430px, tablet and desktop widths; iOS Safari and Android Chrome; landscape, keyboard, screen-reader navigation and reduced motion.
3. Confirm no parent can access another family's child through modified IDs.
4. Distinguish stale attendance and pending academic marking in UI and notification copy.
5. Load-test attendance peaks and dashboards. Index institution, learner and date; minimize polling with event-driven invalidation, conditional GETs, pagination and short-lived cached summaries.
6. Keep production changes behind review and testing; do not merge without sign-off.

## Cost and performance principles
Use existing PostgreSQL rather than creating a separate data store. Batch guardian-dashboard queries, aggregate academic insights on updates rather than on every page view, lazy-load report attachments, and avoid costly minute-by-minute background refreshes. Always display last-updated timestamps and invalidate cached data when teachers publish new results.
