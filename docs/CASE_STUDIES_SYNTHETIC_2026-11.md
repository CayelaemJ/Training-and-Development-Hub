# CABO Learning Hub — Five Synthetic Case Studies for Partner Demonstrations

**Version:** 22 November 2026 • **Demonstration week:** 23–29 November 2026
**Audience:** Schools, education partners, potential sponsors/investors and pilot reviewers
**Evidence label to display on EVERY screen/slide:** **SYNTHETIC CASE STUDY — NOT A REAL SCHOOL OR LEARNER OUTCOME**

Each story describes a realistic operational problem, a demonstrable *software workflow*, its limits, and a *pilot hypothesis*. A fictional mark or case-study scenario is **never** evidence of educational impact or a causal benefit.

## Case study 1 — Recognising support needs, without labelling a learner

**Fictional setting:** [DEMO] Ubuntu Future Secondary School (NSC-style demonstration). **Roles:** learner Sipho Khumalo (`cabo_learner_south_b`), Mathematics teacher (`cabo_teacher_south`), school leader (`cabo_headmaster_south`).

**Problem:** A learner's marks, practice habits and support requests may be scattered. A teacher needs enough context to choose a constructive next step.

**Synthetic story:** Mathematics marks in three *fictional* periods are 48/100 → 56/100 → 64/100. A separate algebraic-fractions support request is assigned to a teacher, with worked-examples guidance and a scheduled follow-up. **Do not imply the support ticket caused the earlier mark changes**: term results precede the October intervention.

**Demonstration:** Open Sipho's learner journey and school-stage observation → inspect Mathematics terms → sign in as teacher to locate the assigned algebra support request → inspect the safe next-step suggestion → show that the staff workflow is human-led.

**What software can prove:** consistent account-scoped learner history, draft support workflow and visible supporting evidence when all related records load.

**What it cannot prove:** identification accuracy, genuine learner improvement, teaching efficacy, diagnosis, national curriculum compliance or any causal effect.

**Pilot hypothesis:** With school agreement and lawful data, teachers can retrieve relevant support context faster and complete follow-up actions more consistently.

**Measurements to collect in a real pilot:** median time from teacher-reported concern to support plan; follow-up completion rate; rate of educator corrections to recommendations; perceived usefulness and false-alarm reviews. **No measured baseline yet.**

**Acceptance:** role-matched marks are consistent; learner B cannot open learner A's history; teacher cannot access the unrelated Physical Sciences gradebook; support case has a named educator and next review.

## Case study 2 — From learning evidence to a reviewable assessment

**Fictional setting:** Same school. **Roles:** learner Lerato Mahlobo (`cabo_learner_south_a`), Mathematics educator, Sciences assessor and headmaster.

**Problem:** AI-drafted questions and scores are easy to create, but high-stakes use without human review would be inappropriate.

**Synthetic story:** Lerato's Mathematics marks read 70 → 76 → 82 across three fictional periods; Physical Sciences 65 → 70 → 74; Life Orientation 74 → 80 → 86. Private notes and a synthetic quiz offer a simple practice view.

**Demonstration:** Learner opens an owned practice document/quiz; assessor opens only assigned Sciences assessments; staff reviews draft versus published marks and available grade event trail. Demonstrate actual AI generation/marking **only** when the AI service is enabled and its outputs independently reviewed.

**What software can prove:** scoped assessment access, private results, publish/mode distinction and grade event provenance.

**Limits:** AI draft marks are not official grades; the synthetic quiz is not an AI model evaluation; question quality and fairness need expert evaluation.

**Pilot hypothesis:** Human-reviewed digital evidence reduces time spent reconciling records without reducing marking quality.

**Measurements:** median assessment preparation time; moderator disagreement rate; accessibility and rubric comprehension; grade correction audit completeness.

**Acceptance:** attempts/grades never leak between learners; non-assigned teacher receives 403/404; audit events remain visible to the authorised reviewer.

## Case study 3 — Parent involvement without automatic child-data disclosure

**Fictional setting:** A family invitation related to learner Lerato. **Role:** guardian Mpho Mahlobo (`cabo_parent_south`).

**Problem:** A school needs to involve families while distinguishing a claimed relationship from verified lawful authority.

**Synthetic story:** An accepted guardian relationship exists, but it is **not verified legal guardianship**. The guardian must not automatically see the child's confidential marks or personally identifying school records.

**Demonstration:** Guardian opens the parent/invitation area → observe relationship state → attempt a protected learner read with an independently authorised test and confirm denial → explain future school-verification and revocation gates.

**What software can prove:** a restrictive boundary and deliberately limited guardian experience.

**Limits:** this is a *negative-control* case study, not evidence that a complete live parental communications programme exists.

**Pilot hypothesis:** Schools can handle relationship claims more consistently while applying appropriate consent and verification.

**Measurements:** unauthorised disclosure attempts blocked; verification turnaround; accuracy of revocation; family satisfaction; incident and audit review.

**Acceptance:** accepted-but-unverified relationship reveals no learner name, learner ID, marks or attendance.

## Case study 4 — School operations, attendance and delegated governance

**Fictional setting:** Ubuntu Future Secondary School and separately [DEMO] Highveld Independent Academy. **Roles:** headmaster Nomsa Dube, district role Zanele Nkosi, separate independent-school leader.

**Problem:** Leaders need a reliable view of authorised school operations without using a shared spreadsheet or exposing a second school's children.

**Synthetic story:** Fictional September/October attendance across three Grade 12 learners includes a small number of absences and late arrivals. A private school notice and management-unit grant are present. The independent school has its own student and framework.

**Demonstration:** Owner sees their school's attendance, notices, aggregate academic evidence and delegated roles → district staff's scope is demonstrated without claiming formal public-sector appointment → switch accounts to confirm independent-school isolation.

**What software can prove:** role/organisation separation, cohort-level example data and record linkage.

**Limits:** this is not SA-SAMS, LURITS, DBE reporting, an official national learner register, a live school attendance system, or an accredited exam report.

**Pilot hypothesis:** Authorised school staff can locate and reconcile a small agreed set of reporting records with fewer manual handovers.

**Measurements:** report compilation time, conflicting-record count, completeness, correction lag, staff satisfaction, privacy exceptions.

**Acceptance:** school A users cannot retrieve school B records; grade totals agree with the underlying fictional assessments; no small-group public rankings or child-identifying exports.

## Case study 5 — Portability, school-to-tertiary aspirations and evidence trust

**Fictional setting:** Highveld Independent Academy (learner Sihle), [DEMO] Mzanzi Digital University (learner Ayanda), and a fictional training organisation.

**Problem:** A learning history should make sense over time, but an unverified milestone must not masquerade as a qualification or admission.

**Synthetic story:** Sihle has an English analysis practice quiz and private creative milestone. Ayanda has a programming assessment and a self-reported TypeScript project milestone. These are **separate fictional accounts**, not a proven cross-institution transfer.

**Demonstration:** Open each learner's private journey → distinguish self-reported skill, published assessment and institutional claim → show admissions/programme concepts only as draft or external handoff if available.

**What software can prove:** modelling of individual learning evidence and a limited pathway interface.

**Limits:** no official application submission, partner university acceptance, certified transcript, cross-school portability guarantee, credential wallet or unrestricted employer access.

**Pilot hypothesis:** Learners and mentors can distinguish different evidence types and identify what requires human verification before a transition.

**Measurements:** source-provenance comprehension, data correction/revocation timeliness, permission error rate, satisfaction and accessibility.

**Acceptance:** independent-school and university records remain isolated; opportunity disclosure is not accidentally enabled; unverified milestones are labelled accurately.

---

## Case study evidence form — complete after each demonstration

| Field | Required evidence |
| --- | --- |
| Study ID and narrative | CS-01 to CS-05 with fictional-data disclaimer |
| Live environment and commit | Exact host, SHA, database marker, active flags; no secrets |
| Test persons and roles | Synthetic usernames only; never publish shared password |
| Tested positive path | Clicks/API status, expected vs observed, screenshot ID |
| Tested negative path | Other learner/teacher/tenant attempted; actual 401/403/404 |
| Source of every chart | Named demo table, exact filter/denominator, period |
| Human-review safeguard | Reviewer action or disabled gate shown |
| Accessibility | Mobile/desktop, keyboard, screen reader, contrast checks |
| Bugs and missing capability | Severity, reproduction, issue link and owner |
| Claim approval | Engineering evidence checked, business wording reviewed |
| Pilot outcome | **Not measured — proposed metric only** until a real authorised pilot |

**Publishing rule:** never change 'synthetic scenario' to 'client success' or use invented ROI/learning outcome percentages. Any public screenshots or LinkedIn case studies must state that the setting and results are simulated.
