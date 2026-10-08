# API — Potential & Opportunities (initial contract)

All routes are mounted under `/api` by the server router. Authenticated session required. JSON responses and request bodies unless otherwise specified.

| Method | Route | Who | Purpose |
|---|---|---|---|
| GET | `/potential/me` | Individual | Own profile and evidence |
| PUT | `/potential/me` | Individual | Update headline/about/aspirations |
| POST | `/potential/evidence` | Individual | Add self-reported evidence |
| DELETE | `/potential/evidence/:id` | Owner | Delete own evidence |
| GET | `/opportunities` | Signed-in users | List active opportunities |
| POST | `/organizations/:orgId/opportunities` | Owner/admin | Publish an opportunity |
| POST | `/organizations/:orgId/potential-access` | Owner/admin, pilot flag | Request scoped profile consent |
| GET | `/potential/access-requests` | Individual | List incoming requests |
| POST | `/potential/access-requests/:id/decision` | Subject | Approve/deny/revoke |
| GET | `/organizations/:orgId/potential-access/:requestId` | Owner/admin, valid grant, pilot flag | Read approved subset and append audit |

## Example create evidence

```json
{"category":"project","title":"Community robotics challenge","description":"Built and explained a prototype with teammates."}
```

Allowed categories: `skill`, `strength`, `growth_area`, `project`, `achievement`, `interest`, `reflection`. Source is set by the server to `self_report`; it must never be displayed as verified without an independent verification workflow.

## Example request

```json
{"personId":"known-existing-account-id","purpose":"Review an application for a specific internship","scope":"portfolio"}
```

Scopes: `portfolio` or `professional`. Requesting requires a company owner/admin membership. Billing and employer-vetting enforcement are pending; flag is disabled by default.

## Example decision

```json
{"decision":"approved"}
```

Only the profile subject can decide. An approved grant expires after seven days. Existing grants can be revoked; pending requests can be denied. Do not use `GET /potential/me` for third-party reads.

## API debt

Add this contract to the central OpenAPI specification and regenerate the typed client; add pagination, rate limits, response schemas, request idempotency, account-age requirements and an explicit company billing entitlement check before production.

## Development overview (dashboard)

`GET /api/development/overview` returns an authenticated, account-owner-only summary:

```json
{
  "profile": {"headline": "", "aspirations": ""},
  "evidence": {"skill": 2, "project": 1},
  "learningStages": 3,
  "milestones": 2,
  "pendingAccessRequests": 0
}
```

Values are database aggregates scoped to the authenticated user ID. This is descriptive data, not an AI personality assessment or prediction. `Cache-Control: no-store` is set to discourage caching of the private response. No institution records, grade results or child-related comments are disclosed here to employers.

UI: Overview > Personal development, with navigation to My potential, My journey and Institutions. The React interface displays explicit loading/error states and 2-column mobile metric tiles.
