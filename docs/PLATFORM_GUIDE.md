# CABO Learning Hub — Complete Platform Guide

**Audience:** learners, families, educators, institutions, partners, the public and software contributors  
**Product owner:** CABO Solutions  
**Platform category:** Connected Education and Lifelong Development Platform  
**Positioning:** Every learner. Every milestone. Every possibility.

> CABO Learning Hub connects learning, development, educational operations, support and future opportunity around a learner's evolving journey. Learning management is one part of the platform, not the whole product.

This guide gives readers a shared understanding of the product and its codebase. It describes the intended platform, explains capabilities evidenced in this repository, and distinguishes implementation from pilots and future plans. It is not a legal compliance certificate, accreditation claim, deployment runbook or promise that every module is enabled in a live environment. Check the [delivery register](./PHASES_1_TO_4_DELIVERY_REGISTER.md) and deployment configuration before making release claims.

## 1. In plain language

CABO is being built to help learners learn, show their progress, receive appropriate support and carry a more continuous record of development as they move between education settings and later opportunities. It brings together digital study, assessment, academic records, institution workflows, reporting, development evidence and carefully governed pathways.

Most education software focuses on a course, class or school year. CABO's product direction is broader: organize useful learning and development context around the person over time, while giving each role only the access it needs. A learner's marks are only one kind of evidence. Self-reported claims, institution records, human-verified achievements and AI-generated interpretations must remain distinguishable.

CABO is **not** an official national learner register, government system, licensed examination authority, accredited qualification issuer or automatic replacement for a school's statutory administration systems. A module's presence in the repository does not establish government approval, accreditation, production readiness or a live institutional integration.

## 2. The need and the intended value

Learning information is often scattered across materials, assessments, classrooms, years and institutions. Marks alone do not explain context, interests, strengths or the support that may help next. CABO aims to connect these signals so that authorized people can act with better context.

The north-star question is:

> **What does this learner need next, and how can the right authorised people help?**

The intended value is clearer learning support, more continuity across milestones, more useful institutional workflows and better evidence-informed planning. These outcomes depend on appropriate implementation, data quality, accessibility, human judgement and institutional validation. The software should support decisions, not present itself as the authority over a learner's future.

## 3. Who the platform is for

- **Learners** use study resources, assessments, feedback and private development records, and should be able to understand and participate in decisions about their information.
- **Educators, tutors and assessors** support learning, review assessment evidence and contribute within their assigned role and scope.
- **Parents and guardians** may support a learner through age-appropriate, verified and consent-aware flows. An invitation or claimed relationship is not proof of legal guardianship.
- **School and institution leaders** manage scoped workflows and review authorized operational or academic information.
- **Districts, departments and public-sector partners** may use appropriately governed aggregate insight in future validated deployments. Repository code does not establish a sanctioned national integration.
- **Universities, TVET providers and adult career partners** are part of the longer-term pathway vision. Access to a learner's childhood or school record must never be assumed or automatic.
- **Developers and delivery partners** maintain the platform, integrate services and implement features under the repository's security, privacy and release rules.

## 4. The six platform pillars

| Pillar | What it covers | How to describe maturity |
|---|---|---|
| Learning and assessment | Materials, practice, question generation, written exams and feedback | Several workflows are implemented or prototyped; AI marks remain advisory and need human moderation for consequential use. |
| Learner journey and development | Milestones, academic progress, interests, strengths and growth evidence over time | Some journey and profile foundations exist; provenance and verification matter. |
| Educator and family support | Human-led support, appropriate guardian involvement and coordination | Institution and guardian workflows are partial or pilot; do not imply universal guardian verification or parent access. |
| Institutional operations and governance | Organizations, roles, academic structures, reporting and operational workflows | Multiple pilots exist; completeness, migrations, access tests and institutional fit must be checked per deployment. |
| Responsible intelligence | AI-assisted learning and assessment, reports, patterns and operational measurement | Limited capabilities and experiments exist; AI is not an autonomous decision-maker and requires evaluation and oversight. |
| Pathways and opportunity | Further study, skills, credentials and adult opportunities | Early foundations exist; employer access is disabled by default and pathways are not yet an accredited credential or admissions service. |

These pillars describe product scope, not a declaration that every feature is complete or available to every user.

## 5. Capabilities and important boundaries

The root [README](../README.md) and linked module documents describe specific workflows. At the time this guide was prepared, repository documentation identifies the following:

### Learning and assessment

- Private uploads of TXT, Markdown, PDF and DOCX study materials.
- Multiple-choice practice tests with automatic grading.
- Written exams generated from uploaded material, including short answer, long answer and scenario questions.
- AI-assisted marking of free-text responses, partial credit, feedback and review flags.
- User-scoped materials, exams and results.

AI-created questions and AI marks can be wrong or incomplete. They are learning aids and draft assessment evidence. They must not be used as final high-stakes grades, certification, employment decisions or regulatory determinations without properly designed human review and validation.

### Organizations and academic work

The repository describes organization workspaces, learner groups, exam assignments, academic periods, subject/module enrollment, gradebook entries, published results, private reports, governance roles and moderation flows. Their maturity varies by feature and branch. Examples of documented gaps include incomplete effective-score integration for overrides, missing official promotion rules and qualifications, unfinished submissions and reporting workflows, and production migration or multi-tenant test gates.

The repository does not claim official NSC/IEB recognition, Umalusi or IEB approval, official transcripts, universal school weighting rules, or university qualification compliance. Institutions must validate their own framework and grading rules with the relevant authorities.

### Learner journey and opportunity

Private, self-reported development and journey concepts aim to preserve context over time. The potential and opportunity module describes voluntary profiles, user-authored evidence, organization-published opportunities, and explicit scoped access requests. Employer access is disabled by default. A request is not consent; membership, subscription or an institution relationship does not substitute for a person's permission.

The current module documentation explicitly identifies age and guardian verification, employer due diligence and entitlement checks, billing, robust export/deletion/retention processes, and full end-to-end authorization validation as outstanding before broad use. Do not enable general employer access based on the presence of the feature flag alone.

### Cross-cutting limits

- A prototype or feature branch is not necessarily deployed or supported in production.
- Data shown in demos or seeded environments is not evidence of live institutional data.
- AI output must be labelled and reviewed appropriately.
- Institution-specific rules and regulatory mappings need independent confirmation.
- A feature is not production-ready merely because its page, route or schema exists.
- Current release status and open validation gates are recorded in the [delivery register](./PHASES_1_TO_4_DELIVERY_REGISTER.md).

## 6. How the system is organized

The repository is a pnpm TypeScript monorepo. The documented high-level components are:

| Area | Repository location | Responsibility |
|---|---|---|
| Learner web application | artifacts/training-platform | React/Vite user interface and role-specific pages |
| API server | artifacts/api-server | Express HTTP endpoints, authentication context, validation and business workflows |
| Shared database package | lib/db | PostgreSQL schema and Drizzle ORM definitions |
| API contract/client | lib/api-spec | Shared API specifications and generated REST client assets |
| Native app work | native-apps | Android and iOS application projects and verification workflows |
| Documentation | docs | Product definitions, architecture, privacy, deployment, module specifications and delivery evidence |
| CI workflows | .github/workflows, .circleci | Build, typecheck, security and native verification automation |

At a high level, a user interacts with the web or native client, which calls the API. The API checks the authenticated identity and authorization, reads or writes PostgreSQL, uses private object storage for materials, and calls configured AI services for selected functions. Client state is not an authorization boundary: ownership, organization scope and consent must be enforced by the server.

### Platform data flow

This logical view shows the normal trust boundaries. The API is the policy enforcement point; clients must not connect directly to the database, object store or model provider. Exact providers and deployment topology depend on the environment.

~~~mermaid
flowchart TD
  Learner["Learner, educator or institution user"] --> Client["Web or native client"]
  Client --> API["Express API"]
  API --> Auth["Authentication and server-side authorization"]
  Auth --> DB[("PostgreSQL via Drizzle")]
  Auth --> Files["Private object storage"]
  Auth --> AI["Configured AI service"]
  AI --> API
  Files --> API
  DB --> API
  API --> Client
  Client --> User["User sees permitted result"]
~~~

### AI-assisted written assessment flow

The assessment lifecycle separates private source material and answer keys from learner-visible questions. The model's score is advisory; any high-stakes outcome needs an appropriate human review step.

~~~mermaid
sequenceDiagram
  actor Learner
  participant Web as Web client
  participant API as Express API
  participant DB as PostgreSQL
  participant Model as AI service
  Learner->>Web: Choose material and exam settings
  Web->>API: Request exam generation
  API->>DB: Verify ownership and read source material
  API->>Model: Generate questions, marks and rubric
  Model-->>API: Draft assessment content
  API->>DB: Store exam and private answer key
  API-->>Web: Return learner-safe questions
  Learner->>Web: Submit written answers
  Web->>API: Submit attempt
  API->>DB: Verify ownership and load rubric
  API->>Model: Request rubric-based draft marking
  Model-->>API: Marks, feedback and review flags
  API->>DB: Store attempt and AI assessment
  API-->>Web: Return feedback and advisory result
~~~

### Consent-gated opportunity disclosure

The opportunity profile path has its own permission boundary. A request alone grants no access; the user's decision, active grant, scope and expiry are checked when the organization reads permitted evidence.

~~~mermaid
sequenceDiagram
  actor Org as Organization administrator
  participant API as Express API
  participant User as Individual user
  participant DB as PostgreSQL
  Org->>API: Request specific profile scope and purpose
  API->>DB: Check organization role and feature flag
  API->>DB: Record pending request
  API-->>User: Notify user of requested scope
  User->>API: Approve, deny or ignore
  API->>DB: Record decision and grant expiry
  Org->>API: Read profile after approval
  API->>DB: Recheck scope, status and expiry
  API->>DB: Record access audit event
  API-->>Org: Return only permitted evidence
~~~

These diagrams show logical flows, not every endpoint, queue, provider, deployment component or database transaction. Review the relevant route, schema, tests and module documentation before changing a data path.

## 7. Data, trust and AI principles

CABO handles potentially sensitive education and child-related information. Contributors must design for least access and minimum necessary data.

1. **Server-enforced access:** identify the caller from trusted authentication context. Never rely on a client-supplied user ID, role or organization ID.
2. **Tenant isolation:** every organization-owned read and mutation must check the caller's membership, role, scope and target record.
3. **Purpose limitation:** collect and expose data only for a stated product purpose and authorized workflow.
4. **Evidence provenance:** distinguish self-reported statements, institution records, verified achievements and AI interpretations.
5. **Consent is specific:** an access request is not approval; revocation and expiry must be checked at the time of access.
6. **AI is fallible:** treat model outputs as untrusted; validate structure, limit input and output, isolate tenant context and keep human review for consequential actions.
7. **Privacy in operations:** avoid logging personal data, study material, tokens or raw prompts unnecessarily. Apply retention and deletion rules.
8. **Child safeguarding:** school history and childhood observations are sensitive. Do not expose them to employers or infer a child's personality, potential or mental state.
9. **Human accountability:** do not automate high-stakes progression, hiring, qualification or safeguarding decisions.
10. **Honest status:** label features as implemented, pilot, planned or blocked using evidence rather than aspiration.

Repository security requirements are in [AGENTS.md](../AGENTS.md). Privacy and consent design requirements are in [PRIVACY_AND_CONSENT.md](./PRIVACY_AND_CONSENT.md).

## 8. Local development orientation

Use Node.js and the repository-pinned pnpm version. Follow current package scripts and environment configuration rather than copying secrets into source files.

~~~
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/training-platform run dev
pnpm run typecheck
pnpm run build
~~~

The database push command is for a controlled development setup only. Inspect schema changes and use reviewed migrations for production; never run destructive schema operations against a live database as a shortcut.

The root README currently identifies PostgreSQL through DATABASE_URL, AI credentials for configured providers, authentication and private object storage as environment-dependent requirements. Exact variables vary by service and feature. Consult deployment docs and service configuration. Keep secrets in the approved secret manager and out of commits, screenshots and logs. Do not assume a local demo, a successful typecheck or a CI workflow proves production readiness.

## 9. A safe contributor workflow

Before implementing a feature:

1. Read this guide, [AGENTS.md](../AGENTS.md), the relevant module documentation and the current delivery register.
2. Trace the frontend page, API route, database schema, generated API contract, permissions and tests that own the behavior.
3. Identify data sensitivity, trust boundaries, tenant scope, abuse cases, migrations and rollout risks.
4. Make a focused change on a working branch. Preserve existing security controls and avoid broad rewrites.
5. Add negative tests for unauthorized users, cross-tenant access, malformed input, abuse limits and consent-state failures where applicable.
6. Run the affected checks and report exact commands and results. State when a check could not be run; never report a skipped check as passed.
7. Update the module docs and delivery register when behavior or maturity changes.
8. Submit a focused pull request with the rationale, test evidence, migration and rollback notes, and unresolved risks.
9. Deploy or rotate secrets only with explicit authorization and verified operational steps.

The full security workflow and hard boundaries are maintained in [AGENTS.md](../AGENTS.md).

## 10. Bringing collaborators on board

Use the documentation as a shared orientation, then let each person go deeper in the areas relevant to their role. A short walkthrough can follow this order:

1. **Start with the learner problem:** explain the fragmentation CABO is trying to address and the north-star question in this guide.
2. **Show the platform map:** walk through the six pillars and the data-flow diagrams above. Explain which parts are live, prototype, pilot or planned for the environment being discussed.
3. **Follow one real workflow:** for example, study material to practice exam to advisory feedback. Show where a human remains responsible and where learner data is protected.
4. **Set expectations clearly:** use the delivery register to identify current capabilities, open gates and decisions still needed. Keep future vision separate from commitments.
5. **Agree on the next contribution:** assign one bounded task, name its owner and reviewer, and agree how success and evidence will be recorded.
6. **Close the loop:** update the relevant module documentation and status when work changes what collaborators can rely on.

### Suggested reading paths

| Audience | Read first | Then use |
|---|---|---|
| Public, families and prospective partners | This guide: sections 1–5 and the external description | [Platform identity](./PLATFORM_IDENTITY.md), [public messaging](./GO_TO_MARKET_MESSAGING.md), and delivery register |
| Educators and institution teams | This guide: audiences, pillars, boundaries and trust principles | [Role-based portals](./ROLE_BASED_PORTALS.md), [governance hierarchy](./GOVERNANCE_HIERARCHY.md), [institution and guardian workflows](./INSTITUTION_TRANSFERS_AND_GUARDIANS.md) |
| Developers and reviewers | This guide: architecture, diagrams, data principles and contributor workflow | [AGENTS.md](../AGENTS.md), [architecture](./ARCHITECTURE.md), relevant module docs, [deployment](./DEPLOYMENT.md), and delivery register |
| Project leads and delivery partners | This guide: product scope, maturity boundaries and onboarding steps | [Product vision](./PRODUCT_VISION.md), [connected sprints](./CONNECTED_HUB_SPRINTS.md), and delivery register |

A good onboarding session should end with shared agreement on the product's present state, the user's needs, the work being proposed, and the evidence required before calling that work complete. Avoid treating the full document set as a one-time reading assignment; use the index to bring the right reference into each discussion.

## 11. Documentation map

- [Documentation index](./README.md)
- [Canonical platform identity and positioning](./PLATFORM_IDENTITY.md)
- [Public messaging guide](./GO_TO_MARKET_MESSAGING.md)
- [Product vision and potential module](./PRODUCT_VISION.md)
- [Architecture and data model](./ARCHITECTURE.md)
- [Privacy, safety and consent](./PRIVACY_AND_CONSENT.md)
- [Deployment, schema and verification](./DEPLOYMENT.md)
- [Phases 1–4 delivery register](./PHASES_1_TO_4_DELIVERY_REGISTER.md)
- [Roadmap and acceptance criteria](./ROADMAP.md)
- [Lifelong learner identity](./LIFELONG_LEARNER_IDENTITY.md)
- [Institution transfers and guardian workflows](./INSTITUTION_TRANSFERS_AND_GUARDIANS.md)
- [Governance hierarchy and roles](./GOVERNANCE_HIERARCHY.md)
- [Role-based portals](./ROLE_BASED_PORTALS.md)
- [Connected Hub sprints](./CONNECTED_HUB_SPRINTS.md)

## 12. External description

**Short description:**  
CABO Learning Hub is a connected education and lifelong development platform designed to bring learning, assessment, learner development and institution workflows into a more continuous journey. It is being developed by CABO Solutions with a focus on learner agency, responsible use of data and human-led support.

**Expanded description:**  
CABO Learning Hub brings together digital study and assessment with academic progress, development evidence, institutional coordination and future pathways. The platform is evolving through prototypes and pilots. Its purpose is to help learners and authorized educators work with clearer context over time, while protecting privacy and keeping human beings accountable for consequential decisions. Feature availability, institutional validation and production readiness vary by module and deployment.

---

**Maintenance note:** Update this guide when the product's canonical identity, system boundaries or major user journeys change. Update implementation status only after checking code, tests, migrations and the delivery register. Keep detailed module behavior in its owning document and link it here rather than letting this overview become a substitute for technical specifications.
