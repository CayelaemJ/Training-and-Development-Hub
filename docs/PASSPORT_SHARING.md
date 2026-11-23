# Passport sharing with universities, colleges and employers

Implements the architecture commitment in `NATIONAL_EDUCATION_ARCHITECTURE.md`:
*"Export to CV and applicant tracking via candidate-approved, revocable,
time-limited shares"*, with *"default is no employer access"*.

## Flow

1. **Learner** (`/passport-sharing`) picks one recipient (any organisation that
   is not a school), a purpose (admission, bursary, employment, internship),
   the sections to share, and 7 to 365 days (default 90).
2. If the learner has a **verified parent or guardian**, the share waits for
   that guardian's approval (`pending_guardian`). Children's personal
   information needs a competent person's consent (POPIA s35; Botswana Data
   Protection Act 2024). The learner cannot approve their own share.
3. **Recipient staff** (owners and administrators of that one institution,
   `/shared-passports`) see active, unexpired shares addressed to them and can
   open each one. Only the chosen sections are returned. Every opening is logged.
4. The learner sees every share, its status, how often it was opened and when,
   and can **stop sharing** at any time. Expiry and revocation end access at once.

## Sections

| Scope | Source | Notes |
| --- | --- | --- |
| `results` | `academic_grades` (published only) | Average per subject and institution |
| `learning_dna` | `learner_support_events` (`learning_dna`) | Latest educator-reviewed state per concept |
| `skills` | `passport_competencies` | Self-reported, labelled as such |
| `verified_achievements` | `passport_achievement_reviews` (`verified`) | Institution name and date; reviewer identity and notes stay private |
| `journey` | `learner_journeys`, `learner_milestones` | Source shown (self-report or institution) |

## Guarantees (tested in `tests/integration/passportShares.integration.ts`)

- Signed-in only; feature off unless `ENABLE_PASSPORT_SHARING=true` or the
  isolated testing database flags are set.
- Schools cannot receive shares; malformed scopes, purposes and periods are refused.
- Pending, declined, revoked and expired shares are invisible to recipients.
- Teachers at the recipient, other institutions, the learner's own school and
  strangers get 404/403. Guardian decisions require a verified relationship.
- Throttled: at most 10 new shares per learner per hour and 20 open shares.

## Not yet (needs external parties)

Verified institution identity for recipients, SAQA/BQA and issuer-signed
credentials, applicant-tracking exports, and ministry/DHET data agreements.
