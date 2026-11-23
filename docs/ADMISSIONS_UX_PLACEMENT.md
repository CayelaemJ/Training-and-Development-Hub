# Admissions & Institutional Mobility — Information Architecture and Release Placement

**27 October 2026 — Web UI added in PR #96. Native mobile/Windows navigation NOT yet implemented.**

CABO is a Connected Education and Lifelong Development Platform. Admissions & Transfers is a **top-level learner lifecycle workspace**. It must not be buried in Academics, Study Materials, School Operations or general profile uploads: parents need it before an enrolment exists; adults need it without already belonging to a school; and destination institutions need scoped onboarding privileges.

## Current web navigation

```text
CABO home / signed-in workspaces
  └─ Admissions & transfers (/admissions)
      ├─ School applications (journey guide; submission NOT LIVE)
      │    └─ Guardian Connect (/guardian-connect, only for authorised roles)
      ├─ University & college
      │    └─ CABO Apply (/cabo-apply, existing real personal draft + official-site handoff)
      │         └─ Applicant's personal tracker and evidence JSON export where allowed
      ├─ Institution transfers (journey guide; submission NOT LIVE)
      │    └─ Institution records (/institution-records, scoped pilot only)
      └─ Admissions desk (authorised institution role; journey guide only)
           └─ Organisations (/organizations, existing institution-management portal)
```

Desktop sidebar and mobile All Pages: one `Admissions & transfers` entry. On mobile, a primary `Admissions` shortcut appears only where the signed-in role is permitted. Existing CABO Apply is **intentionally removed from top-level sidebar**, avoiding a confusing second admissions entry; its existing route and draft tracker remain reachable from the hub.

## Role experience and existing role namespace

| Signed-in portal role | Entry | Default journey | Current onward tool |
|---|---|---|---|
| parent | yes | School | Guardian Connect; institution records |
| learner (including tertiary/adult students) | yes | University/college | CABO Apply; institution records, own learning journey |
| headmaster | yes | Admissions desk | Organisations; guardian authority, scoped records |
| deputy_headmaster | yes | Admissions desk | Organisations; institution records |
| administrator | yes | Admissions desk | Organisations; Guardian Connect |
| superadmin | yes | Admissions desk | Organisations and constrained oversight |
| teaching, assessor, governance and director roles | not yet | no assigned admissions permissions | Do not infer intake privileges from titles |

**Existing role model limitation:** university registrars, financial-aid officers, bursars, admissions reviewers and legal guardians are not all independently represented. Build organisation-scoped assignments with separate least-privilege permission bundles (review documents, reconcile payments, assign student ID, approve modules, credit transfers), and test an account holding different roles at two institutions. Do not grant power by UI route visibility.

**Age capacity limitation:** a current `learner` role does not distinguish minor from adult, or school from tertiary enrolment. Keep actual school/tertiary submission gates behind legally verified, server-derived age and guardianship checks, regardless of hub visibility. This PR adds no new admissions submission endpoints or uploads. Existing `/cabo-apply` is a university draft/handoff pilot and must never be described as official registration.

## Journey architecture to implement

### Child school admissions

School search / official intake → guardian identity and legal authority → purpose-specific consent → temporary evidence / approved institution review → payment or exemption validation → signed scoped submission receipt → receiving institution decision → institution registration and any necessary institutional contacts.

The current Guardian Connect workflow is post-enrolment and **cannot be reused as a pre-admission parental legal proof**. Pre-admission guardian proof and lawful exceptions require a new evidence-backed process. For children, never progress from a draft to submitted without authorised adult involvement and recorded purpose/country.

### Tertiary students

Programme directory and official requirements → authorised qualification checks → institution-versioned module catalogue → AI explanation based on official source → deterministic prerequisite and credit evaluation → adviser review of dual majors/CAT/RPL → external or integrated submission → institution-confirmed payment, enrolment, ID, card and fulfilment. Design can support adults who have no prior CABO school record.

### Transfer

Authorised student or guardian → source and destination authentication → specific signed transcript disclosure consent → legal/country and issuer verification → institutional placement or CAT/RPL review → appeal/refusal with reasons → registrar-confirmed status. No automatic transcript transfer because a receiving school accepted an invitation.

## Cross-platform placements — parity needed after web acceptance

| Platform | Proposed native entry | Safe phase |
|---|---|---|
| Web (React) | Sidebar: Admissions & transfers; role home cards; mobile shortcut + All Pages | **Implemented in PR #96 (pending checks / merge)** |
| Android (Jetpack Compose) | Home tile / bottom navigation destination for student or guardian; native stack for school/tertiary/transfer pathways | Product design only; native navigation changes not in this PR |
| iPhone/iPad (SwiftUI) | Primary family/learner section with role-aware route and iPad side pane | Product design only; native navigation changes not in this PR |
| Windows (WinUI 3) | Dashboard workspace tile and full-width admissions desk view | Product design only; native navigation changes not in this PR |

Do not open a WebView/PWA as a substitute for native admissions functionality. Native clients should use the **same secure server APIs**, user authority, consent state, jurisdiction gates, versioned catalogue, privacy-safe document picker and audit events as the web. The user must not be forced to install another application; browser remains a first-class option. Accessibility: tablet-first staff review queues, low-end Android-friendly form size/validation, accessible names and keyboard workflow, offline-safe *non-sensitive* drafting only after threat modelling.

## Why the design is intentionally staged

As of this change, there are no approved public CABO APIs for official government identity/marks verification, automatic processing of parents' bank documents, authentic school registration, official student-card issuance or course credit awards. A polished screen does **not** prove these integrations exist. Do not market them as operational until signed partner contracts, technical evidence, rigorous synthetic tests, lawful data flows and independent release approvals exist.

See `ADMISSIONS_REGISTRATION_AND_MOBILITY_ZA_BW.md`, `INSTITUTION_TRANSFERS_AND_GUARDIANS.md`, and `legal/ZA_BW_RUNTIME_DATA_RELEASE_GATES.md`.
