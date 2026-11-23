# CABO repository-wide Markdown inventory and documentation maintenance baseline

**Date:** 23 November 2026 · **Source:** complete `main` Git tree at review start · **Scope:** 104 tracked Markdown files.

## What this audit confirms

- Zero open pull requests were returned by GitHub when checked on 23 November 2026; that is a time-specific inventory, not proof of release completion.
- The master [system architecture](../ARCHITECTURE.md) was expanded and merged in PR #214 with the platform's 25-section multi-client domain/AI/data/security map.
- Source includes web/PWA, Android, iOS and Windows clients plus a shared Express API and PostgreSQL/Drizzle models.
- Some October/early-November Markdown still says features are "on a feature branch", release scripts are absent, or the product is only an exam generator. These statements must be interpreted against latest source and current release evidence.
- Historical reviews, signed-off test evidence and legal drafts must **not** be silently rewritten to claim they saw a later state. Date them and link to the current readiness register.
- **This inventory is comprehensive as to filenames, not an assertion that every file has received a line-by-line technical/legal review.** Treat unreviewed files as requiring future validation before use in sales, regulatory or production decisions.

## Current authoritative reading order

1. [Documentation centre](../README.md) and [master system architecture](../ARCHITECTURE.md).
2. [Current release evidence register](RELEASE_READINESS.md).
3. [Production completion audit snapshot](PRODUCTION_COMPLETION_AUDIT.md) and [security review](SECURITY_REVIEW.md).
4. [Multiplatform source and release matrix](../MULTIPLATFORM.md).
5. The specific module, infrastructure or legal document for the work being performed.

## Repository-wide inventory and validation state

| File | Classification / obligation | Review status as of this pass |
| --- | --- | --- |
| [`.agents/memory/MEMORY.md`](../../.agents/memory/MEMORY.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`.agents/memory/pdf-parser-runtime.md`](../../.agents/memory/pdf-parser-runtime.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`AGENTS.md`](../../AGENTS.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`AI_EXECUTION_STATE.md`](../../AI_EXECUTION_STATE.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`README.md`](../../README.md) | Documentation entry point | Source index; content not revalidated line by line |
| [`docs/ADMISSIONS_REGISTRATION_AND_MOBILITY_ZA_BW.md`](../../docs/ADMISSIONS_REGISTRATION_AND_MOBILITY_ZA_BW.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/ADMISSIONS_UX_PLACEMENT.md`](../../docs/ADMISSIONS_UX_PLACEMENT.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/AI_RAG_EVALUATION.md`](../../docs/AI_RAG_EVALUATION.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/API_POTENTIAL.md`](../../docs/API_POTENTIAL.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) | Canonical platform architecture | Source index; content not revalidated line by line |
| [`docs/BI_DATA_QUALITY_AND_ANALYTICS_STANDARD.md`](../../docs/BI_DATA_QUALITY_AND_ANALYTICS_STANDARD.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/CASE_STUDIES_SYNTHETIC_2026-11.md`](../../docs/CASE_STUDIES_SYNTHETIC_2026-11.md) | Synthetic pilot/demo — no live client outcome claims | Source index; content not revalidated line by line |
| [`docs/CASE_STUDY_SPRINT_2026-11-23.md`](../../docs/CASE_STUDY_SPRINT_2026-11-23.md) | Synthetic pilot/demo — no live client outcome claims | Source index; content not revalidated line by line |
| [`docs/CONNECTED_HUB_SPRINTS.md`](../../docs/CONNECTED_HUB_SPRINTS.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/DEMO_ACCEPTANCE_CHECKLIST.md`](../../docs/DEMO_ACCEPTANCE_CHECKLIST.md) | Synthetic pilot/demo — no live client outcome claims | Source index; content not revalidated line by line |
| [`docs/DEMO_ADMISSIONS_INBOX.md`](../../docs/DEMO_ADMISSIONS_INBOX.md) | Synthetic pilot/demo — no live client outcome claims | Source index; content not revalidated line by line |
| [`docs/DEMO_CAPABILITY_CATALOGUE_2026-11.md`](../../docs/DEMO_CAPABILITY_CATALOGUE_2026-11.md) | Synthetic pilot/demo — no live client outcome claims | Source index; content not revalidated line by line |
| [`docs/DEMO_CLIENTS.md`](../../docs/DEMO_CLIENTS.md) | Synthetic pilot/demo — no live client outcome claims | Source index; content not revalidated line by line |
| [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) | Deployment/runbook — verify environment before executing | Source index; content not revalidated line by line |
| [`docs/EIGHT_WORKSTREAM_RELEASE_GATES.md`](../../docs/EIGHT_WORKSTREAM_RELEASE_GATES.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/FREE_SERVICES_ROLLOUT.md`](../../docs/FREE_SERVICES_ROLLOUT.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/GOVERNANCE_HIERARCHY.md`](../../docs/GOVERNANCE_HIERARCHY.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/GO_TO_MARKET_MESSAGING.md`](../../docs/GO_TO_MARKET_MESSAGING.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/INFRA_OPERATIONS_RUNBOOK.md`](../../docs/INFRA_OPERATIONS_RUNBOOK.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/INSTALLABLE_APP_RELEASE.md`](../../docs/INSTALLABLE_APP_RELEASE.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/INSTITUTION_TRANSFERS_AND_GUARDIANS.md`](../../docs/INSTITUTION_TRANSFERS_AND_GUARDIANS.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/LEARNER_SUCCESS_RELEASE.md`](../../docs/LEARNER_SUCCESS_RELEASE.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/LIFELONG_LEARNER_IDENTITY.md`](../../docs/LIFELONG_LEARNER_IDENTITY.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/LIFELONG_PASSPORT_FOUNDATION.md`](../../docs/LIFELONG_PASSPORT_FOUNDATION.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/MOBILE_FAMILY_AND_SCHOOL_INTELLIGENCE.md`](../../docs/MOBILE_FAMILY_AND_SCHOOL_INTELLIGENCE.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/MULTIPLATFORM.md`](../../docs/MULTIPLATFORM.md) | Domain or platform guide — validate maturity against current source | Refreshed in this pass |
| [`docs/NATIONAL_EDUCATION_ARCHITECTURE.md`](../../docs/NATIONAL_EDUCATION_ARCHITECTURE.md) | Canonical platform architecture | Source index; content not revalidated line by line |
| [`docs/NATIVE_MLOPS.md`](../../docs/NATIVE_MLOPS.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/NOTIFICATION_CONSENT_POLICY.md`](../../docs/NOTIFICATION_CONSENT_POLICY.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/NOTIFICATION_OUTBOX_RUNBOOK.md`](../../docs/NOTIFICATION_OUTBOX_RUNBOOK.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/NOTIFICATION_PREFERENCES_ROLLOUT.md`](../../docs/NOTIFICATION_PREFERENCES_ROLLOUT.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/NOTIFICATION_SYNTHETIC_DB_TESTS.md`](../../docs/NOTIFICATION_SYNTHETIC_DB_TESTS.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PASSPORT_SHARING.md`](../../docs/PASSPORT_SHARING.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PASSPORT_TRUST_BOUNDARIES.md`](../../docs/PASSPORT_TRUST_BOUNDARIES.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PHASES_1_TO_4_DELIVERY_REGISTER.md`](../../docs/PHASES_1_TO_4_DELIVERY_REGISTER.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PLATFORM_GUIDE.md`](../../docs/PLATFORM_GUIDE.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PLATFORM_IDENTITY.md`](../../docs/PLATFORM_IDENTITY.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PLATFORM_INFRASTRUCTURE_GAPS.md`](../../docs/PLATFORM_INFRASTRUCTURE_GAPS.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PORTFOLIO_SHOWCASE.md`](../../docs/PORTFOLIO_SHOWCASE.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PRESENTATION_STORYBOARD.md`](../../docs/PRESENTATION_STORYBOARD.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PRIVACY_AND_CONSENT.md`](../../docs/PRIVACY_AND_CONSENT.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PRIVATE_BLOB_ROLLOUT.md`](../../docs/PRIVATE_BLOB_ROLLOUT.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PRIVILEGED_MFA_ROLLOUT.md`](../../docs/PRIVILEGED_MFA_ROLLOUT.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/PRODUCT_VISION.md`](../../docs/PRODUCT_VISION.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/QSTASH_MATERIAL_PREVIEW.md`](../../docs/QSTASH_MATERIAL_PREVIEW.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/RAG_PIPELINE.md`](../../docs/RAG_PIPELINE.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/README.md`](../../docs/README.md) | Documentation entry point | Refreshed in this pass |
| [`docs/RELEASE_GATES_1_TO_8.md`](../../docs/RELEASE_GATES_1_TO_8.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/RENDER_TESTING.md`](../../docs/RENDER_TESTING.md) | Deployment/runbook — verify environment before executing | Source index; content not revalidated line by line |
| [`docs/ROADMAP.md`](../../docs/ROADMAP.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/ROLE_BASED_DEMO_GATE.md`](../../docs/ROLE_BASED_DEMO_GATE.md) | Synthetic pilot/demo — no live client outcome claims | Source index; content not revalidated line by line |
| [`docs/ROLE_BASED_PORTALS.md`](../../docs/ROLE_BASED_PORTALS.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/SECURITY_SCAN_FALSE_POSITIVES.md`](../../docs/SECURITY_SCAN_FALSE_POSITIVES.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/SECURITY_SCAN_REMEDIATION.md`](../../docs/SECURITY_SCAN_REMEDIATION.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/SESSION_SECURITY.md`](../../docs/SESSION_SECURITY.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/SPORTS_AND_EXTRACURRICULAR_DEVELOPMENT.md`](../../docs/SPORTS_AND_EXTRACURRICULAR_DEVELOPMENT.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/TEST_GENERATION_RELEASE.md`](../../docs/TEST_GENERATION_RELEASE.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/TRANSACTIONAL_NOTICES_RUNBOOK.md`](../../docs/TRANSACTIONAL_NOTICES_RUNBOOK.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/cloudflare-full-stack-migration.md`](../../docs/cloudflare-full-stack-migration.md) | Deployment/runbook — verify environment before executing | Source index; content not revalidated line by line |
| [`docs/cloudflare-migration.md`](../../docs/cloudflare-migration.md) | Deployment/runbook — verify environment before executing | Source index; content not revalidated line by line |
| [`docs/engineering/AI_RAG.md`](../../docs/engineering/AI_RAG.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/engineering/CLAUDE_EXECUTION_STATE.md`](../../docs/engineering/CLAUDE_EXECUTION_STATE.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/engineering/COMPLETION_AUDIT.md`](../../docs/engineering/COMPLETION_AUDIT.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/engineering/MASTER_COMPLETION_BACKLOG.md`](../../docs/engineering/MASTER_COMPLETION_BACKLOG.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/engineering/PRODUCTION_COMPLETION_AUDIT.md`](../../docs/engineering/PRODUCTION_COMPLETION_AUDIT.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/engineering/PR_INVENTORY_2026-11-22.md`](../../docs/engineering/PR_INVENTORY_2026-11-22.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/engineering/RELEASE_READINESS.md`](../../docs/engineering/RELEASE_READINESS.md) | Engineering evidence / dated audit — preserve historical context | Refreshed in this pass |
| [`docs/engineering/REQUIREMENTS_TRACEABILITY.md`](../../docs/engineering/REQUIREMENTS_TRACEABILITY.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/engineering/SECURITY_REVIEW.md`](../../docs/engineering/SECURITY_REVIEW.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/engineering/TEST_REPORT.md`](../../docs/engineering/TEST_REPORT.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/engineering/TEST_RESULTS.md`](../../docs/engineering/TEST_RESULTS.md) | Engineering evidence / dated audit — preserve historical context | Source index; content not revalidated line by line |
| [`docs/legal/BOTSWANA_PRIVACY_NOTICE_DRAFT.md`](../../docs/legal/BOTSWANA_PRIVACY_NOTICE_DRAFT.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/INSTITUTION_DPA_DRAFT.md`](../../docs/legal/INSTITUTION_DPA_DRAFT.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/PRIVACY_NOTICE_DRAFT.md`](../../docs/legal/PRIVACY_NOTICE_DRAFT.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/SUNDAY_RELEASE_GATE.md`](../../docs/legal/SUNDAY_RELEASE_GATE.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/TERMS_OF_SERVICE_DRAFT.md`](../../docs/legal/TERMS_OF_SERVICE_DRAFT.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/ZA_BW_COMPLIANCE_APPLICABILITY_MATRIX_2026-10-26.md`](../../docs/legal/ZA_BW_COMPLIANCE_APPLICABILITY_MATRIX_2026-10-26.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/ZA_BW_INSTITUTION_DATA_ADDENDUM_DRAFT.md`](../../docs/legal/ZA_BW_INSTITUTION_DATA_ADDENDUM_DRAFT.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/ZA_BW_LIVE_SCHOOL_RELEASE_GATES.md`](../../docs/legal/ZA_BW_LIVE_SCHOOL_RELEASE_GATES.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/ZA_BW_NATIVE_PARENT_SCOPING_2026-10-26.md`](../../docs/legal/ZA_BW_NATIVE_PARENT_SCOPING_2026-10-26.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/ZA_BW_RUNTIME_DATA_RELEASE_GATES.md`](../../docs/legal/ZA_BW_RUNTIME_DATA_RELEASE_GATES.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/ZA_BW_SCOPED_ATTENDANCE.md`](../../docs/legal/ZA_BW_SCOPED_ATTENDANCE.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/ZA_BW_SCOPED_LEARNER_READS.md`](../../docs/legal/ZA_BW_SCOPED_LEARNER_READS.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/legal/ZA_BW_SYNTHETIC_END_TO_END_RESULTS_2026-10-26.md`](../../docs/legal/ZA_BW_SYNTHETIC_END_TO_END_RESULTS_2026-10-26.md) | Legal/privacy draft — review jurisdiction and currency | Source index; content not revalidated line by line |
| [`docs/r2-ai-knowledge-foundation.md`](../../docs/r2-ai-knowledge-foundation.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/r2-staging-cost-controls.md`](../../docs/r2-staging-cost-controls.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`docs/reviews/CHATGPT_REVIEW_HANDOFF.md`](../../docs/reviews/CHATGPT_REVIEW_HANDOFF.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`native-apps/DEVICE_INCLUSION_MATRIX.md`](../../native-apps/DEVICE_INCLUSION_MATRIX.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`native-apps/FEATURE_PARITY.md`](../../native-apps/FEATURE_PARITY.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`native-apps/README.md`](../../native-apps/README.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`native-apps/SELF_HOSTED_CHECKS.md`](../../native-apps/SELF_HOSTED_CHECKS.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`native-apps/TEST_ADMIN_SETUP.md`](../../native-apps/TEST_ADMIN_SETUP.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`native-apps/android/README.md`](../../native-apps/android/README.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`native-apps/android/TEST_BUILDS.md`](../../native-apps/android/TEST_BUILDS.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`native-apps/ios/TEST_BUILDS.md`](../../native-apps/ios/TEST_BUILDS.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`native-apps/windows/RELEASE_NOTES.md`](../../native-apps/windows/RELEASE_NOTES.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`native-apps/windows/TEST_BUILDS.md`](../../native-apps/windows/TEST_BUILDS.md) | Native platform guide — check real device and release evidence | Source index; content not revalidated line by line |
| [`replit.md`](../../replit.md) | Domain or platform guide — validate maturity against current source | Source index; content not revalidated line by line |
| [`services/cloudflare-django-worker/README.md`](../../services/cloudflare-django-worker/README.md) | Deployment/runbook — verify environment before executing | Source index; content not revalidated line by line |

## Documentation backlog for the next development session

1. Check every file labelled domain/platform guide against its actual route and schema before marking it technically current.
2. Consolidate obsolete and contradictory hosting runbooks; preserve old release instructions as archived history, never execute blindly.
3. Ensure all native feature-parity statements reference a tested artifact and supported device version.
4. Add API method/DTO/role matrix generated from current route files and Zod contracts.
5. Keep synthetic case studies distinct from prospect/customer pilots, and review every quantitative claim.
6. Update legal templates only with qualified professional review; do not imply POPIA/Botswana compliance is already certified.
7. Reconcile every historic audit blocker with a dated CI run, migration test, release artifact, security review or real staging observation.
8. After code resumes, make changed-domain documentation part of pull-request acceptance criteria.

**Maintenance note:** do not bulk-replace all `.md` files with generic templates: doing so would destroy valuable historical evidence and detailed operational procedures.
