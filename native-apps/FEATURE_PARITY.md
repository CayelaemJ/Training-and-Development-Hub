# CABO Native App Feature Parity

## Product rule

Android is implemented in Kotlin with Jetpack Compose. iPhone and iPad are implemented in Swift with SwiftUI. Both clients use CABO's authenticated APIs and server-side role/tenant permissions. They do not embed or render the web application. A web route is not considered native parity until its native screen, actions, failure states, accessibility behavior, and permission checks are implemented and tested.

The native apps are currently **partial clients**, not feature-complete releases. The web application remains the feature inventory and behavior reference; the backend remains authoritative for access and stored data.

## Web route inventory

| Web capability | Learner | Parent | Educator | Leadership / admin | Native status |
| --- | --- | --- | --- | --- | --- |
| Role dashboard | Yes | Yes | Yes | Yes | Partial summaries on Android and iOS |
| Learner Success Loop | Yes | — | Teacher / school leaders | Admin | Missing native workspace |
| Education Command | — | — | Limited | National to school leaders | Missing native workspace |
| Assessment question bank | — | — | Teacher / school leaders | Admin | Missing native workspace |
| School intelligence | — | — | School leaders | Admin | Missing native workspace |
| Report issuance and integrity | Learner previews | Guardian previews | School leaders | Admin | Native school submission, independent approval, issue, reject and revoke actions are implemented; learner/guardian integrity verification and official report viewing remain partial |
| Guardian Connect | — | Invitations | School verification | Admin | Android and iOS support invitations, protected reports, and the server-authorized school review action; institutional ownership and evidence must still be confirmed in end-to-end acceptance |
| Education reports | Learner preview | Verified reports | Assigned school scope | Admin | Learner/parent previews partial; reporting workflow missing |
| University applications | Apply and track | — | — | Admin catalog | Missing native workspace |
| School progression | — | — | School leadership | Admin | Missing native workspace |
| Institution setup and stages | — | — | School leadership | Admin | Missing native workspace |
| Institution hub modules | Role-specific | Role-specific | Role-specific | Role-specific | Missing native workspace |
| School operations | Learner views | Family views | Attendance/timetable/notices | School leadership | Missing native workspace |
| Career passport and potential | Learner profile | Shared summaries | Supported review | Admin policy | Missing native workspace |
| Lifelong learner journey | Learner identity, self-reported education timeline and milestones | — | — | — | Identity/timeline/milestone create, read and delete now available natively on Android/iOS; lifelong passport and credential workflows remain missing |
| Sports and development plan | Learner goals | Family view | Coach/teacher view | School leadership | Missing native workspace |
| Platform administration | — | — | — | Superadmin | Read-only organisation list only |
| Organizations, academics, governance, records | Role scoped | Verified family records | Assigned school scope | Role scoped | Missing native management flows |
| Materials, practice quizzes, written exams | Learn and submit | — | Create/assign/review | Assigned scope | Materials and practice quizzes partial on Android/iOS; written exams missing |
| Support requests and learner-help queue | Create and follow | — | Read/reply/triage/assign/practice checkpoints | Assigned oversight | Android and iOS support flows include learner request detail and feedback, educator replies, triage, authorised educator assignment, practice checkpoints, status transitions, published-result comparison and Learning DNA review; remaining end-to-end acceptance and adjacent support administration still need completion |

Roles and page access must always come from the authenticated backend response. Native navigation may hide unavailable pages for usability, but it cannot grant access or infer authorization from the device.

## Delivery sequence

1. **Native shell and parity foundation:** secure PKCE login, account/session lifecycle, role-aware navigation, consistent CABO visual tokens, loading/empty/error states, TalkBack/VoiceOver and large text, phone/tablet layouts, CI builds for Android and iOS.
2. **Learner and family journeys:** learning materials and upload, practice and written assessments, learner success/journey, support, reports, guardian invitations and verified family reports, development and admissions drafts. The self-reported education timeline and milestones are implemented on both clients; the wider learner-success, family, admissions and credential flows are still incomplete.
3. **Educator workspace:** assigned classes, learner-support lifecycle, classroom materials, question bank, assessments/marking, attendance, notices and timetables.
4. **Institution and platform administration:** school setup, organization and role management, governance, transfers, report issuance/review/integrity, school and district analytics.
5. **Potential, activities and passports:** learner development evidence, sports and activities, career/passport disclosures, opportunity access and reviews.
6. **Parity acceptance:** exercise every live route/action for every allowed role on supported Android phones/tablets and iPhones/iPads, including offline, interrupted requests, expiry, accessibility and device-size cases.

## Completion gate

A capability moves to complete only when all of these are true on both native platforms, unless the web route is explicitly platform-specific:

- The native screen follows the CABO visual system and is usable at 320dp phone width, larger text, landscape, and tablet layouts.
- Every read and mutation calls the existing API with the signed-in account; roles, tenant IDs, guardian access and destructive permissions remain enforced by the server.
- Empty, loading, retry, validation, offline and uncertain-submission states are visible and cannot silently lose or duplicate consequential work.
- Sensitive records are not copied into shared preferences, logs, analytics or an unreviewed offline cache. Tokens stay in Android Keystore-backed storage or iOS Keychain.
- Automated tests cover the intended flow and its important denied/failed cases, and Android emulator plus iOS Simulator build/test checks pass.
- The capability is exercised with synthetic accounts on a physical device before a production/store readiness claim.

## Recent native additions

- The native family-access review surfaces accepted and verified guardian relationships only when the existing school review endpoint authorizes the signed-in account. Both clients require an explicit reviewer confirmation before submitting a decision. The API remains authoritative for institution ownership, active enrollment, invitation acceptance, and revocation rules. No identity documents are collected by the native review flow.
- Native school report issuance now supports report submission, independent approval, issue, reject and revoke on both platforms. The server remains authoritative for school-manager access, two-person review, valid report transitions and snapshot integrity. Learner and guardian issued-report presentation and explicit integrity verification still need native completion.
- Android and iOS support lifecycle changes, learner feedback, published result comparison, and Learning DNA review are in the current delivery sequence. They are not a substitute for the missing route families listed above or for complete device acceptance.
