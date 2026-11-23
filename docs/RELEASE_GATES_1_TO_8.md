# CABO School-to-Career Platform — Eight Release Gates

This is the engineering acceptance matrix, **not** a certification statement. Code presence, green CI and successful Render deployment do not independently prove a user journey.

## 1. Authenticated end-to-end demonstration
Current pilot: test principals, role portals, school enrolments, report previews, guardian reviews and synthetic fixtures.
Sign-off requires repeatable automated browser testing for independent principal, educator, learner and guardian sessions, cross-school 403/404 tests, session expiry and mobile accessibility. No real child data in the acceptance dataset.

## 2. Issued report cards and qualifications
Current pilot: published academic marks, versioned report snapshots, two-person review, SHA-256 integrity fingerprints, revocation audit and student/verified guardian views.
Sign-off requires official school/issuer authority, suitable asymmetric signing with rotation/revocation and trusted verification; curriculum-specific promotion/reporting policy; correction/appeal processes and end-to-end tamper testing. Hashes are not signatures.

## 3. School attendance and timetable automation
Current pilot: institution-scoped attendance, offline sync API, opt-in IndexedDB outbox with explicit shared-device warning and manual conflict review, conflict-aware timetable creation and audited teacher substitution.
Sign-off requires real mobile device offline/reconnect E2E, account-bound draft clearing, device encryption or approved managed-device policy, teacher-substitution approval and notification, safe QR attendance design with anti-spoof/replay protections and actual timetable optimisation.

## 4. Academic intelligence and MLOps
Current pilot: subject-level marks, threshold-based risk indicators, human-reviewed development plans, Groq-only configuration, latency/failure metrics, isolated provider smoke test. If Groq is unavailable, plan drafting returns a clearly labelled non-AI template.
Sign-off requires privacy-preserving offline eval fixtures, fairness/accuracy review, safeguards against unreliable high-stakes predictions, model/prompt version control, failure budgets, escalation, monitoring and actual end-to-end provider evidence.

## 5. Assessment Studio
Current pilot: per-institution question bank with licensing and attribution, draft/moderation workflow, existing quizzes and written exams.
Sign-off requires calibrated rubrics, assessed curriculum alignment with qualified teachers, accessibility accommodations, release controls, double marking where needed, examiner audit and real per-role E2E.

## 6. University admissions, registrars and careers
Current pilot: programme directory, CABO Apply application drafts, candidate-controlled evidence exports, external handoff reference logging and career/talent evidence.
Sign-off requires signed university/CAO integrations, accurate programme requirements and deadlines, duplicate-submission avoidance, signed receipts, verified issuer credentials, full separate university registrar accounting and candidate-controlled disclosure grants. **No real university submission** is implied by a CABO draft.

## 7. Education Command Centre
Current pilot: authorised per-institution rollups with minimum-cohort suppression, governance role delegation, enrolment and attendance reporting.
Sign-off requires proven district/circuit/provincial mappings, lawful DBE/EMIS/SA-SAMS/LURITS interfaces, scalable aggregation with differential disclosure checks, authorized data-source provenance, audit and independently validated reports.

## 8. Production security, legal and operations
Current pilot: scoped authorization, audit entries, CI, Render isolated test deployment and server-side configuration.
Sign-off requires POPIA lawful-basis and child-processing legal assessments, independent penetration test, incident response, vendor/subprocessor contracts, encryption/key policies, secure migrations, immutable recovery-tested backups, monitoring/alerting, accessibility/performance verification and contractual agreements with real institutions.

## Repeatable technical checks
- Run tests, TypeScript, build: `pnpm install --frozen-lockfile && pnpm run typecheck && pnpm run build`.
- Isolated test accounts only: `CABO_TEST_URL=https://cabo-learning-native-isolated-preview.onrender.com CABO_TEST_USERNAME=<test-username> CABO_TEST_PASSWORD=<test-password> node scripts/verify-cabo-eight-workstreams.mjs`.
- The script checks eight authenticated/public endpoint behaviours without printing secrets or records. It does **not** write data and cannot substitute for multi-user browser E2E.
- Keep test credentials out of the command history where possible (environment secret provider); never hardcode them, put them in README examples with real values, or pass them in screenshots.

## Presentation truth-in-advertising
Demonstration features should be identified as synthetic pilots. Government integration, certified learner records, psychometric tests, university applications and verified employer integrations must not be represented as live without evidence and contracts.

## Public distribution evidence

The APK and simulator bundles used in the pilot are test artifacts. A store-eligible build still needs a separate acceptance review. Record the release commit, distribution channel, evidence link, reviewer, and approval date for each applicable item.

| Area | Evidence needed before public release |
| --- | --- |
| Shared backend | Identify the production Render service and Neon database. Verify real sign-in, reviewer access and learner/staff/guardian permissions end to end. Demonstrate that synthetic reviewer accounts cannot reach real school records. Test backup recovery, service monitoring and rollback. |
| Google Play | API 36 Android build, signed release AAB and Play App Signing, 16 KB native-library compatibility verified on the release artifact, and physical Android 16 and minimum-device acceptance. Complete Play App Access, Data safety, target audience/content rating, privacy policy and applicable closed testing. |
| Apple App Store | Xcode 26 or newer with iOS 26 SDK or newer, signed device archive, App Store Connect record, physical-device and TestFlight checks, review notes and usable reviewer accounts, privacy labels, age rating, export declaration and required listing URLs/screenshots. Verify privacy-manifest accuracy against the build and backend. |
| Web and Windows | Public privacy/support links, signed-in browser and Windows acceptance, keyboard and screen-reader checks, and signed Windows packages verified on clean devices. Review public download and support paths. |
| Identity and deletion | Document who may create accounts and who operates school-managed identities. When store account-deletion rules apply, verify the in-app request path and Google Play's external web path. Test identity verification, session revocation, data removal, legally required retention and the user's status notification. The current web Privacy Rights screen explains rights and does not by itself demonstrate a completed deletion workflow. |
| Children and school data | Confirm launch countries and declared ages, responsible parties and operators, lawful processing and guardian authority, school/provider agreements, retention and rights handling, breach response and cross-border transfers. Confirm Google Families applicability and Apple age-rating/Kids Category implications. Obtain qualified review before using real learner data. |
| AI and messaging | Trace what prompts, document contents and identifiers leave CABO. Where applicable, disclose and obtain explicit permission before third-party AI sharing, test abuse handling and in-app reporting, and verify moderation/escalation and provider retention. Keep features outside the approved data and moderation scope off the public release. |

References for review: [Google Play target API](https://support.google.com/googleplay/android-developer/answer/11926878), [Families](https://support.google.com/googleplay/android-developer/answer/9893335), [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111), [AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936), [Apple submission requirements](https://developer.apple.com/news/upcoming-requirements/), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [South African Information Regulator guidance](https://inforegulator.org.za/guidance-notes/), and [Botswana government privacy guidance](https://bpsc.gov.bw/index.php/privacy-notice).
