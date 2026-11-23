# CABO Learning Hub — Demo Readiness Sprint, 23–29 November 2026

**Goal by Friday 27 November:** a credible 20-minute live walkthrough and **five evidence-labelled synthetic case studies** for prospective schools, partners and sponsors. Weekend 28–29 November is for retrospective and corrections, not a promise of unattended delivery.

**Founding context:** CABO Solutions is currently an independently developed initiative; no paying school customers, registered corporate standing, government approvals or measured commercial traction should be implied.

## Roles and decision rights

| Role | Responsibility | May approve |
| --- | --- | --- |
| Cayelaem (technical founder) | Seed data, environment safety, API/UI defects, CI, cross-tenant tests, deployment evidence, code review and demo architecture | Technical claims, deployment and security readiness |
| Bokamoso (business development / operations support) | Partner-segment research, presentations, outreach drafts, lead tracker, meeting notes, pilot logistics, feedback forms, business case, nontechnical QA and narrative edits | Business clarity and logistics; **not** code, legal or technical security approval |
| Teacher/education reviewer (to recruit) | Evaluate whether scenarios, curriculum mapping, teacher language and support recommendations make sense | Educational-scenario accuracy for a limited pilot |
| Legal/privacy reviewer (to recruit) | POPIA/Botswana child-data, role consent, retention and partner agreement review | Their own professional legal opinion; do not pre-claim sign-off |
| Pilot partner (not yet confirmed) | Scope, appropriate permissions, lawful data and success measures | School-specific operational go/no-go |

**Daily working rhythm:** 15-minute priorities check; end-of-day evidence and blocker log; never call a screen ready just because it exists in source control.

## Monday 23 Nov — establish truth and prepare data

- Engineering: merge only verified seed changes; use a disposable DB with the mandatory three seed gates. Check authenticated learner-journey, milestones, school stages, attendance and term assessments; note exact commit SHA.
- Engineering: resolve the exposed weak test password by network restricting the demo service or rotating to a strong short-lived secret before external presentations.
- Operations: build target list of 10–15 prospective schools/partners; document their likely pain points without pretending they are clients. Draft participant consent/data-handling checklist.
- **Deliverables:** capability catalogue, exact demo URL/commit, five fictional personas, risks and open-issues log.

## Tuesday 24 Nov — learner and educator story

- Walk CS-01 support and CS-02 assessment on desktop and mobile; record what was actually shown (no synthetic efficacy claims).
- Check 2026 Term 1/2/3 marks, support ticket ownership, correction history, quizzes, role isolation and deliberately non-official wording.
- Operations: edit two 1-page case studies; recruit one educator to provide a nonbinding scenario critique.
- **Deliverables:** two reviewed demo walkthroughs with screenshots, negative-access evidence and a gap list.

## Wednesday 25 Nov — guardian and school leadership story

- Walk CS-03 parent privacy boundary and CS-04 attendance/governance. Test unverified parent denial and cross-school 403/404.
- Cross-check attendance counts, grade denominators, scoped rankings and school notice permissions.
- Operations: build school-facing value proposition and pilot discovery script; maintain meeting and risk tracker.
- **Deliverables:** two more 1-page case studies, privacy/access test log, partner interview questions.

## Thursday 26 Nov — pathways, accessibility and infrastructure

- Walk CS-05 learner journey, self-reported evidence, training/university concepts with admissions **draft/handoff only**.
- Conduct mobile/desktop, keyboard and failure-state checks, plus test account sign-out/revocation.
- Operations: draft a 10–12 slide CABO-branded presentation (clay `#C4673A`, gold `#C9A84C`, ink `#0D1117`, cream `#F5EDE0`, teal `#1D6B6B`), a 1-page fact sheet, and discovery-email copy. Business and engineering review claims before external distribution.
- **Deliverables:** fifth case study, accessibility observations, storyboard and investor/school claims register.

## Friday 27 Nov — showcase and pilot proposal

- Perform a 20-minute dry run on the **actual approved URL** (not only localhost), measuring broken navigation and recovery time.
- Compile five case studies into one **SYNTHETIC DEMONSTRATION** pack, clearly separating working features, gates, roadmap and required partner validation.
- Choose an initial *prospective* pilot segment; define proposed pilot size, stakeholder roles, lawful data source, owner, duration, consent, retention and escalation before approaching real children.
- **Deliverables:** demo sign-off matrix, five case studies, lead/research tracker, slide draft, pilot measurement plan and next-step proposal. Publish externally only once risks and claims are approved.

## Saturday–Sunday 28–29 Nov — corrections and retrospection

- Triage failed acceptance tests; scope the following week; keep unstable work in staging.
- Update the catalogue, actual evidence links and open claim gaps.

## 20-minute suggested live agenda

| Minutes | Narrative | Live role / feature | Fallback if unstable |
| --- | --- | --- | --- |
| 0–2 | Define platform and synthetic-data disclaimer | Landing page | Approved static platform diagram |
| 2–6 | How a learner sees connected evidence | Lerato learner journey, marks, milestones | Scrubbed verified screenshot |
| 6–10 | Educator support and accountable decisions | Sipho support and teacher view | Test trace + issue if incomplete |
| 10–13 | School operations and permissions | Headmaster, attendance, academic periods | Recorded sanitized query/report |
| 13–15 | Parent safety boundary | Unverified guardian denied | Written negative-auth test output |
| 15–17 | Future learning pathways | University learner and self-report | Explicit ROADMAP/PILOT slide |
| 17–20 | What can be piloted and how it will be measured | Capability and privacy gates | 1-page pilot scope |

## Gate checklist before a school/investor meeting

- [ ] Synthetic data only; no real learner IDs, emails, photos, marks or third-party documents.
- [ ] An exact verified deployment SHA and test database, 14 role fixtures if claimed, and expected seed counts.
- [ ] Full role login/logout, account isolation, child/guardian access-denial tests and approved fallbacks.
- [ ] No public demo with a shared `12345` password unless protected by a separate access restriction.
- [ ] All case-study metrics marked **hypothesis/not yet measured**, not reported impact.
- [ ] Mobile/desktop accessible screenshots; screens containing data labelled **SYNTHETIC DEMO**.
- [ ] No government-accreditation, revenue, client/pilot result, certification or legal-compliance claims.
- [ ] Named person signs off engineering claims; business owner checks pitch and follow-up records.

## Prospective pilot measurement plan

Set baseline and follow-up *after* partner selection, never invent values.

| Proposed outcome | How measured | Guardrail |
| --- | --- | --- |
| Time to assemble a learner support context | Structured teacher task timing | Cannot claim improved learner attainment |
| Timeliness of documented follow-up | Tickets with plan and completed scheduled review / eligible tickets | Distinguish missed and not-due actions |
| Time to reconcile a subject mark | Timed permissioned reconciliation task | No alteration of official mark policy |
| Attendance/report data consistency | Audit of synthetic then authorised school records | No automated government submissions |
| Privacy / access control | Negative cross-tenant and guardian tests | Zero disclosures required; investigate any failure |
| Usability and accessibility | Observed task completion, keyboard and screen-reader checks | Devices and language needs recorded |
| Cost and technical capacity | Measured API latency, requests, storage, AI tokens per permitted use | Do not publish unverified scalability estimates |

**End state:** a defensible *pilot invitation*, not an assertion that the national education platform is production certified.
