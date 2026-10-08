# CABO Role-Based Portals and Academic Permissions

## Why a hierarchy needs more than separate menus

The interface must reflect the **server's** permissions. A hidden button is not protection: every API endpoint must authenticate, constrain institutional scope, and check the requested operation against authorised membership, grants and course assignments.

## Test superadmin

For the isolated Railway `testing` environment, the existing `cabo_test` website account signs in to a fixed internal user ID. The API recognises that account as superadmin **only if all three conditions hold**:

1. `RAILWAY_ENVIRONMENT_NAME=testing`
2. `ENABLE_CABO_SUPERADMIN=true`
3. `CABO_SUPERADMIN_USER_ID` equals the authenticated user ID.

The website username is not trusted as an authorisation claim. No new password is stored in source control. This arrangement is **temporary for isolated testing**, not a production identity and governance model.

The test superadmin sees the platform command centre, counts of organisations, memberships and organisational units, a cross-organisation administrative registry, and the latest administrator audit events. Superadmin operations on organisation, hierarchy, academic and institution administrative endpoints are logged to `platform_admin_audit`. Do not assume this log is tamper-proof or covers all legacy endpoints; a comprehensive audited access broker is required before production.

Superadmin is the highest **platform administrative** authority. Childhood records, parent relationships, health information and personal development evidence are still protected by explicit purpose and privacy controls. Superadmin is not a waiver of lawful disclosure requirements.

## Role-resolved dashboards

`GET /api/portal/me` returns a role, assigned organisational scopes, server-produced summary and permitted navigation cards. It does not accept a role parameter from the client. UI navigation reflects the same role but cannot grant access.

| Role | Landing view | Scope |
|---|---|---|
| Superadmin | Platform command centre | Testing platform operations and audited cross-organisation admin |
| National director | National oversight | Delegated national tree within the member organisation |
| Provincial director | Provincial oversight | Delegated provincial subtree |
| District director | District operations | Delegated district subtree |
| Group executive | Multi-school group leadership | Delegated group subtree |
| Governing body chair | Governing responsibility | Explicit school governance grant |
| Headmaster | School leadership | Assigned institution + separately authorised operations |
| Deputy headmaster | Deputy principal desk | Delegated school responsibilities |
| Department head | Department leadership | Delegated department |
| Grade head | Grade coordination | Delegated grade |
| Teacher | Teaching desk | Assigned courses; no all-school learner records by default |
| Assessor | Assessment desk | Assigned courses; no all-school learner records by default |
| Administrator | Institution administration | Existing permissions and delegated governance only |
| Learner | Personal learning | Own learning data, not another learner's data |
| Parent | Guardian relationship desk | Invites/relationships; no automatic learner grade access |

When an account has several roles, its highest ranked granted role selects the default portal. Institutional role grants are scoped to one organisation, and a portal preference does not override API permissions.

## New API and security enforcement

- `GET /api/platform/overview`: superadmin-only organisation names and IDs.
- `GET /api/platform/audit`: superadmin-only recent admin actions (limited).
- `GET /api/portal/me`: owner-specific role resolution.
- `GET /api/organizations/:orgId/academic/course-staff`: organisation owner/admin or isolated superadmin.
- `POST /api/organizations/:orgId/academic/course-staff`: assign a registered organisation staff member to an existing course. Staff cannot nominate themselves.
- Academic grade changes, assessments, linked exam moderation, queues, leaderboards, and school reports require server-checked owner/admin authority or an explicit assigned course. Learners can only access their own published report.
- All-school user roster, group mutations, staff submissions and grade overrides in the legacy Organizations API now require organisation owner/admin or the isolated superadmin. These remain administrator workflows until per-group teaching assignments are implemented.

## Limitations and mandatory release gates

- An academic course staff assignment is distinct from a management hierarchy role. A manager does not automatically receive permission to teach or change grades.
- Full teacher/class/group mappings, subject-specific learning progress dashboards, verified parent visibility, application-wide impersonation with approval, delegated leadership reporting at all levels, and consistent audit coverage are not yet implemented.
- This test login uses one account, not a test suite with independent principals. Verify isolation with separate authenticated school, teacher, district, parent, guardian and learner accounts before release.
- `drizzle-kit push` is configured only for the **isolated test database**. Production must use reviewed, versioned migrations, backups and rollback.
- Review the lawful basis and required safeguards for all children's data under POPIA. Never enable unrestricted employer access through the platform superadmin feature.
- Server authorisation must be re-tested after merging or changing a user's role, membership, organisation or assigned course.

## Testing checklist

1. Sign in to isolated CABO test as `cabo_test`. The root view should show platform command centre and `/platform-admin`.
2. Confirm `GET /api/platform/overview` and `GET /api/platform/audit` return for superadmin, 403 for others.
3. Create test schools and hierarchy units, delegate roles at the correct level.
4. Check district director cannot delegate a national/provincial role and cannot access unrelated tenant.
5. Assign a teacher to one course only, verify grades, reports and pending exams in other courses return 403 or are excluded.
6. Check a learner cannot list institutional members or school-wide submissions.
7. Check a parent cannot access learner academic grades solely due to a guardian invitation.
8. Confirm audit records appear after elevated school and academic administrative operations.
9. Check mobile portrait/landscape, desktop widths, keyboard focus and empty states.
