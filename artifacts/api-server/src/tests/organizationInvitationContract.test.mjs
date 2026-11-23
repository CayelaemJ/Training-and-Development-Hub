// Source-level regression guards for consent-based organization membership.
// They complement organizationInvitationPolicy.test.mjs (rules) and
// organizationInvitationDatabase.test.mjs (DDL invariants).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
function handler(file, method, path) {
  const start = file.indexOf(`router.${method}("${path}"`);
  assert.ok(start >= 0, `${method.toUpperCase()} ${path} must exist`);
  const next = file.indexOf("\nrouter.", start + 1);
  return file.slice(start, next < 0 ? undefined : next);
}

test("adding a member by email creates an invitation, never a membership", () => {
  const routes = source("../routes/organizations.ts");
  const add = handler(routes, "post", "/organizations/:orgId/members");
  assert.doesNotMatch(add, /insert\(organizationMembersTable\)/);
  assert.match(add, /insert\(organizationInvitationsTable\)/);
  assert.match(add, /uniformInvitationResponse\(\)/);
  assert.match(add, /status\(202\)/);
  // Expired open invitations are refreshed, unexpired ones left unchanged.
  assert.match(add, /onConflictDoUpdate\(/);
  assert.match(add, /targetWhere:sql`status = 'pending'`/);
  assert.match(add, /setWhere:sql`\$\{organizationInvitationsTable\.expiresAt\} <= now\(\)`/);
  assert.doesNotMatch(add, /onConflictDoNothing/);
  // The old account-existence oracle must not return.
  assert.doesNotMatch(add, /status\(404\)/);
  assert.doesNotMatch(add, /userId:person\.id/);
});

test("memberships from invitations are created only in the invitee's decision route", () => {
  const routes = source("../routes/organizations.ts");
  const inserts = [...routes.matchAll(/insert\(organizationMembersTable\)/g)].length;
  // 1: owner row when creating an organization; 2: invitee acceptance.
  assert.equal(inserts, 2);
  const decide = handler(routes, "post", "/organization-invitations/:invitationId/decision");
  assert.match(decide, /inviteeEmail\(req,id\)/);
  assert.match(decide, /mayRespondToInvitation\(invitation,email,new Date\(\)\)/);
  assert.match(decide, /\.for\("update"\)/);
  assert.match(decide, /userId:id,role:invitation\.role/);
});

test("invitee email trust requires the provider-verified session email", () => {
  const routes = source("../routes/organizations.ts");
  assert.match(routes, /verifiedInviteeEmail\(row\?\.email,session\.verified_email\)/);
  const inbox = handler(routes, "get", "/organization-invitations");
  assert.match(inbox, /inviteeEmail\(req,id\)/);
  assert.match(inbox, /eq\(organizationInvitationsTable\.status,"pending"\)/);
  assert.match(inbox, /gt\(organizationInvitationsTable\.expiresAt/);
});

test("manager invitation list never joins account records", () => {
  const routes = source("../routes/organizations.ts");
  const list = handler(routes, "get", "/organizations/:orgId/invitations");
  assert.match(list, /guard\(req,res,oid\.data,managers\)/);
  assert.doesNotMatch(list, /usersTable/);
});

test("staff and hierarchy assignment no longer distinguish unknown accounts", () => {
  const academic = source("../routes/academic.ts");
  assert.doesNotMatch(academic, /registered staff account not found/);
  const hierarchy = source("../routes/managementHierarchy.ts");
  assert.doesNotMatch(hierarchy, /The account must be registered first/);
});
