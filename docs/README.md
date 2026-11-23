# CABO Learning Hub — Documentation Centre

**Baseline:** 23 November 2026 | **Product:** Connected Education and Lifelong Development Platform | **Maintainer:** independent CABO Solutions product development.

This is the documentation entry point for the entire connected education system, not merely its first study/assessment module. The repository contains implementation, prototype, pilot, candidate and target designs. **Source presence, zero open PRs and passed CI are not certification of real school deployment or production child-data readiness.**

## Start with the current references

| Need | Document |
| --- | --- |
| Whole-system modules, tenancy, API, data, AI, infrastructure, native clients, diagrams and failure modes | [Master architecture](ARCHITECTURE.md) |
| Scope, business journey and role experiences | [Platform guide](PLATFORM_GUIDE.md) · [Product identity](PLATFORM_IDENTITY.md) · [Role-based portals](ROLE_BASED_PORTALS.md) |
| Up-to-date verification gates | [Release readiness](engineering/RELEASE_READINESS.md) · [Production audit snapshot](engineering/PRODUCTION_COMPLETION_AUDIT.md) |
| Security, safety and country-law boundaries | [Security review](engineering/SECURITY_REVIEW.md) · [Privacy](PRIVACY_AND_CONSENT.md) · [ZA/BW live-school gates](legal/ZA_BW_LIVE_SCHOOL_RELEASE_GATES.md) |
| Operations, availability, migration and hosting | [Infrastructure runbook](INFRA_OPERATIONS_RUNBOOK.md) · [Deployment](DEPLOYMENT.md) · [Infrastructure gaps](PLATFORM_INFRASTRUCTURE_GAPS.md) |
| Web, Android, iOS and Windows | [Multiplatform](MULTIPLATFORM.md) · [Native feature parity](../native-apps/FEATURE_PARITY.md) |
| Document-grounded AI and quality evaluation | [RAG](RAG_PIPELINE.md) · [AI evaluation](AI_RAG_EVALUATION.md) |
| Learner identity, enrolment and verified disclosures | [National target](NATIONAL_EDUCATION_ARCHITECTURE.md) · [Passport trust](PASSPORT_TRUST_BOUNDARIES.md) |
| School operations and admissions | [Admissions](ADMISSIONS_REGISTRATION_AND_MOBILITY_ZA_BW.md) · [Hierarchy](GOVERNANCE_HIERARCHY.md) |
| School demos | [Capability catalogue](DEMO_CAPABILITY_CATALOGUE_2026-11.md) · [Synthetic scenarios](CASE_STUDIES_SYNTHETIC_2026-11.md) |
| Engineering storytelling | [Technical showcase](PORTFOLIO_SHOWCASE.md) |

## Documentation conventions

- **Implemented in main** means source or workflow exists, **not** live operational proof.
- **Feature-gated or pilot** means additional configuration, migrations, review or explicit institutional permission is required.
- **Design/target** means a proposed outcome; never present as shipped.
- **Verified staging** requires dated deployment SHA, test output and synthetic-only proof.
- **Verified production** requires owner sign-off, lawful real-data handling, security testing and operational evidence.
- **Archived audits** are timestamped evidence, not living status dashboards. Amend a current register instead of rewriting what a past audit observed.

## Demo and outreach evidence

The 23–29 November 2026 demo pack is **synthetic**. No real government registration, approved national learner register, signed institutions or commercial traction can be inferred from it. Review [go-to-market messaging](GO_TO_MARKET_MESSAGING.md) before external use.

## Contribution rules

Follow [AGENTS.md](../AGENTS.md): no secrets, no live child records, scoped authorisation, negative regression tests and review of deployment migrations. When a domain changes, update source-to-document references in the [master architecture](ARCHITECTURE.md) and the corresponding runbook.

**Repository PR count on 23 November:** zero open; this is a moment-in-time check.
