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
| Report issuance and integrity | — | Guardian views | School leaders | Admin | Report previews only; issue/review flows missing |
| Guardian Connect | — | Invitations | School verification | Admin | Parent decisions and protected reports partial; school review missing |
| Education reports | Learner preview | Verified reports | Assigned school scope | Admin | Learner/parent previews partial; reporting workflow missing |
| University applications | Apply and track | — | — | Admin catalog | Missing native workspace |
| School progression | — | — | School leadership | Admin | Missing native workspace |
| Institution setup and stages | — | — | School leadership | Admin | Missing native workspace |
| Institution hub modules | Role-specific | Role-specific | Role-specific | Role-specific | Missing native workspace |
| School operations | Learner views | Family views | Attendance/timetable/notices | School leadership | Missing native workspace |
| Career passport and potential | Learner profile | Shared summaries | Supported review | Admin policy | Missing native workspace |
| Sports and development plan | Learner goals | Family view | Coach/teacher view | School leadership | Missing native workspace |
| Platform administration | — | — | — | Superadmin | Read-only organisation list only |
| Organizations, academics, governance, records | Role scoped | Verified family records | Assigned school scope | Role scoped | Missing native management flows |
| Materials, practice quizzes, written exams | Learn and submit | — | Create/assign/review | Assigned scope | Materials and practice quizzes partial on Android/iOS; written exams missing |
| Support requests and learner-help queue | Create and follow | — | Read/reply/triage | Assigned oversight | Android partial; iOS interaction missing |

Roles and page access must always come from the authenticated backend response. Native navigation may hide unavailable pages for usability, but it cannot grant access or infer authorization from the device.

## Delivery sequence

1. **Native shell and parity foundation:** secure PKCE login, account/session lifecycle, role-aware navigation, consistent CABO visual tokens, loading/empty/error states, TalkBack/VoiceOver and large text, phone/tablet layouts, CI builds for Android and iOS.
2. **Learner and family journeys:** learning materials and upload, practice and written assessments, learner success/journey, support, reports, guardian invitations and verified family reports, development and admissions drafts.
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
