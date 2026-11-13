# CABO Learning Hub — Stakeholder and Developer Onboarding Pack

**Audience:** learners, families, educators, institutions, partners, the public and software contributors  
**Product owner:** CABO Solutions  
**Platform category:** Connected Education and Lifelong Development Platform  
**Positioning:** Every learner. Every milestone. Every possibility.

> CABO Learning Hub connects learning, development, educational operations, support and future opportunity around a learner's evolving journey. Learning management is one part of the platform, not the whole product.

This pack is designed to give readers a full shared understanding of the product and its codebase, with role-specific reading paths and a self-contained explanation of its workflows. It describes the intended platform, explains capabilities evidenced in this repository, and distinguishes implementation from pilots and future plans. It is not a legal compliance certificate, accreditation claim, deployment runbook or promise that every module is enabled in a live environment. Check the [delivery register](./PHASES_1_TO_4_DELIVERY_REGISTER.md) and deployment configuration before making release claims.

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

## 11. End-to-end user journeys

These journeys explain how the product areas fit together. A deployment may expose only a subset; use the delivery register for the actual release state.

### Learner studies and receives feedback

1. The learner signs in and uploads study material to their private workspace.
2. The web client sends the request to the API. The API authenticates the session, validates the file and checks ownership.
3. The API stores file content in private object storage and tracks permitted metadata in PostgreSQL.
4. The learner selects material and assessment settings. The API reads the learner-owned source, calls the configured model to draft questions and a rubric, and stores answer keys privately.
5. The client receives only the learner-facing exam content. The learner submits answers to the API.
6. The API loads the relevant rubric, requests draft AI marking, validates/limits the result and stores the attempt and feedback.
7. The learner sees an advisory result. For organizational or academic use, an authorized educator reviews and publishes a mark through the applicable workflow.

**Boundary:** do not return private answer keys or rubrics to the learner before assessment. AI scores are not final institutional grades without moderation.

### Institution creates an academic workflow

1. An organization owner or administrator creates the workspace and configures its organization-specific structure.
2. Existing registered users are added according to the current membership workflow. Organization membership does not by itself grant every academic permission.
3. Staff, courses, groups, academic periods and assessments are configured as supported by the deployment.
4. The organization assigns work to an appropriate learner group or course.
5. Learners access only their own data and assigned work; staff access depends on server-checked role, organization scope and course assignment.
6. A teacher or assessor reviews work, makes any permitted adjustment with a reason, and publishes the supported result.
7. Authorized staff view scoped reports. Learners see their own published report.

**Boundary:** governance hierarchy grants management responsibility, not automatic teaching or grading authority. Official promotion, transcript and qualification rules are outside the current claims.

### Learner requests a school transfer or guardian connection

1. A learner with an active enrollment requests a transfer to a destination organization.
2. The destination organization's owner/admin reviews the request, subject to the membership conditions in the pilot.
3. Historical enrollment remains intact. The current transfer workflow does not automatically move grades or formally close the source record.
4. Separately, a learner can invite an existing account as a guardian.
5. The invited account can accept or decline. Acceptance records the relationship invitation outcome only; it does not unlock private grades, reports or academic records.

**Boundary:** institution-admin attestation is not school accreditation, identity verification or a government-certified record. Legal guardianship and minor consent checks are still required before parent data access.

### Candidate controls an opportunity disclosure

1. The individual writes a voluntary profile and self-reported evidence.
2. An organization can publish an opportunity under its authorized role.
3. In a gated pilot, an organization administrator requests a specific profile scope and gives a purpose.
4. The individual approves, denies or later revokes. A grant is limited in scope and expires; the API checks the grant at read time and records access.
5. Only the allowed subset is returned. Institution grades, childhood records and private reflections are excluded.
6. Career application submission and employer features remain separately feature-gated; a vacancy or draft application is not proof of formal recruitment integration.

**Boundary:** employer access is off by default. Do not enable it for general production until the privacy, age, safeguarding, employer verification, billing, abuse prevention and end-to-end test gates are met.

## 12. Roles, scopes and authority

CABO uses multiple authorization concepts. They must not be conflated:

- **Authentication** answers who is making the request.
- **Organization membership** says the account belongs to a tenant.
- **Institutional hierarchy grants** assign delegated management roles inside a tenant-contained structure.
- **Course staff assignment** grants a teaching or assessment relationship to a particular course; it is distinct from hierarchy rank.
- **Learner ownership** limits personal records to their subject unless a supported, separately authorized workflow applies.
- **Consent grants** authorize only the specific purpose and scope, for the grant's lifetime.
- **Feature flags** can disable a pilot route; a flag never replaces authorization.

| Role | Typical view | Permission boundary |
|---|---|---|
| Learner | Own learning, journey, assigned work and published results | No access to another learner's private records |
| Teacher / assessor | Assigned teaching or assessment work | Course assignment and permitted actions are checked by the API |
| Institution administrator / owner | Organization setup and explicitly authorized administration | Scoped to that organization; cannot cross tenant boundaries |
| School or delegated leader | Governance and operational view for assigned subtree | Delegated hierarchy does not automatically grant course teaching or access to all sensitive details |
| Parent / guardian | Relationship/invitation workflow | Accepted invitation alone provides no academic-record access |
| Platform superadmin | Restricted platform operations in isolated testing | Test-only guard; does not waive privacy or lawful disclosure controls |
| Employer / opportunity organization | Public opportunity functions and, in a gated pilot, approved evidence | No private profile read without explicit, current permission and feature enablement |

When accounts hold multiple roles, the resolved dashboard is a convenience. Every API call still enforces the action-level permission. Hiding a control in the UI is never an authorization safeguard.

## 13. Product module inventory and maturity

This table is a compact orientation across the major modules described in the repository. Exact readiness varies by commit, environment, feature flag, schema migration, test coverage and partner validation.

| Module | User value | Repository-described state | Main unresolved boundary |
|---|---|---|---|
| Study materials and written exams | Turn personal study materials into exercises and receive feedback | Implemented/prototype workflows | AI quality, quotas, moderation and robust production controls |
| Organizations and learner groups | Coordinate staff, learners and assigned work | Core workflows plus feature development | Invitations, removal, migrations, complete tenant E2E coverage |
| Academics and gradebook | Track periods, subjects, assessments and published results | Pilot/development workflows | Official curriculum rules, complete submissions and validated grading policy |
| Role-based portals | Show a relevant start page for granted roles | Role resolution and portal work described | Server checks remain essential; not every legacy screen is fully role-specific |
| Governance hierarchy | Delegate responsibilities through tenant-contained units | API and workspace foundation described | Institution-specific structure, reporting safeguards and broad acceptance tests |
| Attendance and notices | Record daily attendance and institution notices | API/UI described in delivery register | Physical class roster workflows, offline sync and full operational validation |
| Learner journey and development | Preserve milestones and voluntary evidence | Private/profile foundations described | Verification, correction/export/deletion, provenance and long-term retention |
| Institution enrollment and transfers | Record admin-attested enrollment and learner-led transfer requests | Pilot | No accredited school verification, legal identity validation or automatic record transfer |
| Guardian connections | Let a learner invite an existing account | Pilot | No legal guardian validation, child consent or parent access to academic data |
| Potential and opportunities | Manage personal evidence and organization-listed opportunities | Initial consent-controlled module | Employer access disabled by default; age, company, billing and safeguarding gates |
| Career applications | Record candidate-controlled job applications | API/model/frontend work; submission gated | Applications feature flag must remain off until safety and verification gates pass |
| Qualifications wallet | Provide a future place for verified credentials | Module shell/foundation; issuance locked | Verified issuers, digital signing, revocation and verification API |
| University registrar / admissions | Organize future tertiary pathways | Early records/drafts/pilot concepts | No official application submission, admission decision or university integration |
| Sports and bursaries | Capture wider development and opportunity evidence | Activity/registry foundations | Provider verification, consent and mature operational workflows |
| Assessment studio / psychometrics | Organize assessment workflow and development metadata | Limited private metadata foundations | No validated/licensed instruments, professional governance or employment decision use |
| Education command centre | Support scoped leadership oversight | Restricted dashboards and hierarchy APIs | No official national integration or broad, validated aggregate reporting |
| Mobile and offline access | Extend access to mobile and low-connectivity settings | Native/mobile workflows and CI projects exist | Do not promise store distribution, full parity or secure offline sync until validated |
| Institution integrations | Connect with approved external systems | Inventory/API foundations | No provider contracts or mature production OAuth, revocation and webhook operations |

The "implemented" label in code or a delivery note means that some implementation exists. It does not mean the feature is complete, enabled, validated with real institutions, or ready for public production.

## 14. Data model and API orientation

The platform stores different kinds of records for different purposes. Keep them separate and preserve their source and status.

| Data area | Typical records | Source / access rule |
|---|---|---|
| Account and session | Authenticated user identity | Existing authentication integration; API derives caller identity from the session |
| Learning | Materials metadata, exam questions, attempts and feedback | Personal records are user-scoped; source files live in private object storage |
| Organization | Organizations, memberships, groups and staff assignments | Tenant-scoped; API checks membership, role and target entity |
| Academic | Periods, subjects/modules, assessments, grades and reports | Institution-scoped; publishing and staff access are controlled workflows |
| Governance | Management units and role grants | Same-organization hierarchy; delegated authority is limited to permitted descendants |
| Institution history | Enrollments, transfer requests and guardian relationship invitations | Attested/invited workflow with explicit limitations; not official certification |
| Potential and opportunity | Profiles, evidence, opportunities, access requests and audits | Candidate-owned evidence is self-reported until verified; employer disclosure requires a valid grant |
| Hub registry | Module and institution records | Individual and sensitive record kinds have different visibility rules; credential/assessment issuance fails closed while locked |

For the potential module, the documented API uses authenticated routes under /api. Examples include GET and PUT /potential/me for a person's own profile, POST /potential/evidence to create self-reported evidence, GET /opportunities to list opportunities, organization-scoped opportunity creation, and the gated potential-access request/decision/read routes. The full request contract is in [API — Potential and Opportunities](./API_POTENTIAL.md). New routes must also be represented in the central API specification/client where required by the repository's conventions.

Database schema is maintained under lib/db/src/schema, with module-specific files such as organizations and academic. Before adding or changing data, identify record ownership, organization scope, retention, migrations, indexes, audit needs and deletion/correction behavior. Never add an unreviewed production schema push.

## 15. Build, test and release lifecycle

### Developer setup

The repository uses pnpm workspaces and TypeScript packages. The baseline commands documented in the root README are:

~~~
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/training-platform run dev
pnpm run typecheck
pnpm run build
~~~

Use the repository's pinned tool versions and frozen lockfile in CI. The database push command is a development convenience only; isolate its database and inspect changes first. For production, prepare and review migrations, rehearse them in staging and prepare a rollback.

### What a feature needs before release

- Server-side authentication, object ownership and tenant-aware authorization.
- Input validation, file-size/type limits, safe query handling and abuse controls.
- Tests for allowed and denied cases, especially cross-user, cross-tenant and wrong-role access.
- Schema migration review, backup, staging rehearsal and rollback plan.
- Privacy and safeguarding review for personal, education or child data.
- AI evaluation and human review where output can affect marks or opportunities.
- Accessible UI and supported-device validation.
- CI evidence for the actual required checks; a typecheck/build alone does not prove integration or security behavior.
- Operational visibility, incident handling, retention and cost controls appropriate to the service.
- Human review and clear release notes that distinguish available, pilot, gated and planned functionality.

### Current release posture

The delivery register records implementation and outstanding verification separately. Documented open work includes independent multi-user and cross-school E2E verification, production-grade authentication, age/registration checks, broad rate limiting, tamper-resistant audit trails, versioned migrations, disaster recovery and penetration testing. Some workflows have isolated synthetic-data test previews; these are not production deployments. Check the current branch, environment and feature flags at release time.

## 16. Shared vocabulary

| Term | Meaning in CABO documentation |
|---|---|
| Learner journey | A person's learning and development context over time, with source and verification status preserved |
| Evidence | A claim or record about learning, achievement, interest or capability; provenance determines how it may be used |
| Self-reported | Entered by the individual and not independently verified |
| Attested enrollment | A record entered by an organization administrator; not proof of accreditation or legal identity |
| Human-reviewed | A responsible authorized person has reviewed the relevant evidence; preserve who reviewed it and what changed |
| AI-assisted | A model contributed a draft, suggestion or assessment; the output remains fallible and is not automatically authoritative |
| Tenant | An organization boundary used to scope memberships, roles and records |
| Management hierarchy | Delegated administrative responsibility among units inside one organization |
| Course assignment | A separate teaching/assessment grant scoped to a course |
| Consent grant | Explicit permission for a stated purpose and scope, subject to expiry and revocation |
| Pilot | A bounded, controlled use that still has stated validation or operating gates |
| Production-ready | A release conclusion supported by required implementation, tests, security/privacy review, operations and rollback evidence |
| Synthetic data | Invented test/demo data; it must be clearly labeled and never presented as real learner or institution records |

## 17. Questions every collaborator should be able to answer

Before someone is considered onboarded, they should be able to explain:

1. What learner problem is CABO trying to solve, and why is it broader than an LMS?
2. Which workflows are actually available in the environment being discussed, and which are pilots or plans?
3. How does a request travel from client to server, and where are identity, tenant scope and consent enforced?
4. Which information is self-reported, institution-attested, independently verified or AI-generated?
5. What can the person's role see and change, and what does that role not grant automatically?
6. Why are AI assessment results advisory, and who is accountable for final decisions?
7. What safeguards and validation are still required before child, guardian, employer or official institution workflows can be used broadly?
8. Which docs, tests, migration steps and release evidence apply to the work they are taking on?

If these answers are unclear, pause feature commitments and use the documentation to resolve product scope, authority and acceptance criteria before implementation or public claims.

## 18. Documentation map

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

## 19. External description

**Short description:**  
CABO Learning Hub is a connected education and lifelong development platform designed to bring learning, assessment, learner development and institution workflows into a more continuous journey. It is being developed by CABO Solutions with a focus on learner agency, responsible use of data and human-led support.

**Expanded description:**  
CABO Learning Hub brings together digital study and assessment with academic progress, development evidence, institutional coordination and future pathways. The platform is evolving through prototypes and pilots. Its purpose is to help learners and authorized educators work with clearer context over time, while protecting privacy and keeping human beings accountable for consequential decisions. Feature availability, institutional validation and production readiness vary by module and deployment.

---

**Maintenance note:** Update this guide when the product's canonical identity, system boundaries or major user journeys change. Update implementation status only after checking code, tests, migrations and the delivery register. Keep detailed module behavior in its owning document and link it here rather than letting this overview become a substitute for technical specifications.
