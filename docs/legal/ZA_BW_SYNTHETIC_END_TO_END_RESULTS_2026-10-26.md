# CABO ZA / Botswana — authenticated synthetic-data staging evidence
Date: 26 October 2026. **Technical test evidence only. Not legal clearance.**

## Environment separation
- Dedicated Render preview: `https://cabo-za-bw-compliance-synthetic-preview.onrender.com`, Frankfurt, auto-deploy OFF.
- Dedicated Neon rehearsal branch `br-green-mouse-b9clwd0i` under the native-demo *isolated* Neon project `lively-dream-83982597`, separate from CABO Learning Hub production.
- `CABO_COUNTRY_PILOT_ENFORCEMENT=true` in the isolated preview only. Existing CABO Learning Hub Render services not reconfigured.
- Four clearly labelled fake schools: ZA #1 and #2, Botswana #3 and #4; synthetic learner accounts A, B, C and a synthetic guardian. The approvals, transfer assessments and vendor-locality labels used here are **fictional QA fixtures**, NOT school authorisations or evidence of in-country Botswana copies.
- Short-lived sessions were issued for only fake users directly in isolated QA database; no session values are stored in the repository. Do not copy these into a real school environment.

## Observed HTTP results (isolated preview)
Using authenticated fictional learners from an independent QA runner:

| Scenario | Observed |
|---|---|
| Synthetic learner A reads ZA #1 attendance | 200, only A's `present` day; no teacher notes |
| Learner B reads ZA #1 attendance | 200, only B's `absent` day |
| Learner C reads ZA #1 attendance, despite an approved school | 200, empty array |
| Learner C reads their own ZA #2 attendance | 200, only C's `late` day |
| Learner A reads ZA #2 attendance | 200, empty array |
| Learner A lists ZA #1 enrolments | 200, only A's record |
| Learner C lists ZA #1 enrolments | 200, empty array |
| Learners A, B, C list issued reports for their own schools | 200, one correct report each |
| Learner A reads issued reports for ZA #2 | 200, empty array |
| Learner A checks integrity of own issued report | 200 (unsigned synthetic fixture explicitly reports no valid signature) |
| Learner A checks learner B's report integrity | 403 |
| Learner C checks learner A's report integrity | 403 |
| Approved Botswana QA school | 200 with no cross-school attendance; **synthetic only** |
| Revoked Botswana QA school | 409 |
| Invalid organisation path | 400 |
| Legacy cross-school `institution-records/me` or unscoped development plan | 409 |
| Fake guardian's school-specific issued report **before** test revocation | 200 |
| Same guardian after newer school-specific revocation event | 403 on issued and draft guardian reports |

These tests establish actual authenticated HTTP separation for the paths exercised, **not** coverage of all API routes, native clients, background jobs, backups, AI provider calls or data sovereignty.

## Reproduce without committing tokens
On a machine you control, obtain newly generated, time-limited QA-only session tokens for synthetic users from the isolated Neon rehearsal branch. Supply these as process environment variables (not command history or screenshots) to:

```sh
CABO_QA_BASE_URL=https://cabo-za-bw-compliance-synthetic-preview.onrender.com/ \
CABO_QA_SYNTHETIC_ONLY=true \
CABO_QA_ORG_ZA_ONE=<isolated fixture id> \
CABO_QA_ORG_ZA_TWO=<isolated fixture id> \
CABO_QA_ORG_BW_APPROVED=<isolated fixture id> \
CABO_QA_ORG_BW_REVOKED=<isolated fixture id> \
CABO_QA_SID_A=<ephemeral session> \
CABO_QA_SID_B=<ephemeral session> \
CABO_QA_SID_C=<ephemeral session> \
CABO_QA_SID_GUARDIAN=<ephemeral session> \
node --test scripts/qa/za-bw-synthetic-smoke.test.mjs
```

This suite **refuses** any other hostname and performs **GET only**. It checks response bodies rather than HTTP codes alone. A run in regular CircleCI without isolated QA sessions intentionally cannot be substituted for a staging run.

## Risk finding and release gate
The current institution-scoped incoming transfer queue and transfer-decision routes check the **receiving** school only. They may reveal an origin school's learner IDs or other jurisdictional metadata. This phase blocks these routes under country-pilot enforcement until both source and destination authorisations, same-jurisdiction scope (or a lawfully reviewed cross-border mechanism), audit and per-learner consent are enforced and tested. No legacy transfer queue should be exposed to a real school in the meantime.

The strict-country pilot cannot be activated on real learner data without documented school-by-school approval, actual subprocessor inventory, child-data lawful basis, Botswana Data Protection Act 2024 transfer/copy assessment by counsel where relevant, verified backup residency, guardian and native-device E2E, and accountable human legal/security sign-off. Existing production enforcement remains OFF.
