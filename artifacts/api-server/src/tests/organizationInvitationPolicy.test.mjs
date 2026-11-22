import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInvitationEmail, isInvitableRole, mayInvite, uniformInvitationResponse,
  verifiedInviteeEmail, mayRespondToInvitation, isInvitationDecision,
} from "../lib/organizationInvitationPolicy.ts";

const now = new Date("2026-11-22T10:00:00Z");
const later = new Date("2026-12-06T10:00:00Z");
const pending = (email, expiresAt = later) => ({ status: "pending", email, expiresAt });

test("emails are trimmed and lowercased; malformed or oversized values are rejected", () => {
  assert.equal(normalizeInvitationEmail("  Learner.One@Example.ORG "), "learner.one@example.org");
  for (const bad of [undefined, null, 42, "", "no-at-sign", "a@b", "two@@example.org", "a b@example.org",
    "line\nbreak@example.org", "x@" + "a".repeat(330) + ".org"]) {
    assert.equal(normalizeInvitationEmail(bad), null, String(bad));
  }
});

test("owner is never invitable and only owners or superadmins can invite admins", () => {
  assert.equal(isInvitableRole("owner"), false);
  assert.equal(mayInvite("owner", "owner", false), false);
  assert.equal(mayInvite("owner", "admin", false), true);
  assert.equal(mayInvite("admin", "admin", false), false);
  assert.equal(mayInvite(null, "admin", true), true);
  for (const r of ["teacher", "assessor", "learner"]) {
    assert.equal(mayInvite("admin", r, false), true, r);
    assert.equal(mayInvite("owner", r, false), true, r);
  }
});

test("non-managers cannot invite anyone", () => {
  for (const actor of ["teacher", "assessor", "learner", undefined, null, "superadmin"]) {
    for (const target of ["admin", "teacher", "assessor", "learner"]) {
      assert.equal(mayInvite(actor, target, false), false, `${actor} -> ${target}`);
    }
  }
});

test("invite response is identical regardless of input and names nobody", () => {
  const a = uniformInvitationResponse();
  const b = uniformInvitationResponse();
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a).sort(), ["message", "status"]);
  assert.doesNotMatch(JSON.stringify(a), /userId|firstName|lastName|@/);
});

test("invitee email is trusted only when the session holds the same provider-verified address", () => {
  assert.equal(verifiedInviteeEmail("Learner@Example.org", "learner@example.org"), "learner@example.org");
  assert.equal(verifiedInviteeEmail("learner@example.org", undefined), null, "unverified provider email");
  assert.equal(verifiedInviteeEmail("learner@example.org", "other@example.org"), null, "mismatched session email");
  assert.equal(verifiedInviteeEmail(null, "learner@example.org"), null, "account without email");
});

test("only the verified addressee can answer a pending, unexpired invitation", () => {
  assert.equal(mayRespondToInvitation(pending("learner@example.org"), "learner@example.org", now), true);
  assert.equal(mayRespondToInvitation(pending("learner@example.org"), "LEARNER@example.org", now), true);
  assert.equal(mayRespondToInvitation(pending("learner@example.org"), "someone@example.org", now), false, "other account");
  assert.equal(mayRespondToInvitation(pending("learner@example.org"), null, now), false, "no verified email");
  assert.equal(mayRespondToInvitation(null, "learner@example.org", now), false, "missing");
});

test("answered, revoked and expired invitations cannot be answered again", () => {
  for (const status of ["accepted", "declined", "revoked"]) {
    assert.equal(mayRespondToInvitation({ ...pending("a@example.org"), status }, "a@example.org", now), false, status);
  }
  assert.equal(mayRespondToInvitation(pending("a@example.org", now), "a@example.org", now), false, "expires exactly now");
  assert.equal(mayRespondToInvitation(pending("a@example.org", new Date("2026-11-01")), "a@example.org", now), false);
  assert.equal(mayRespondToInvitation(pending("a@example.org", new Date("invalid")), "a@example.org", now), false);
});

test("only accept and decline are valid decisions", () => {
  assert.equal(isInvitationDecision("accepted"), true);
  assert.equal(isInvitationDecision("declined"), true);
  for (const bad of ["revoked", "pending", "verified", "", null, undefined, true]) {
    assert.equal(isInvitationDecision(bad), false, String(bad));
  }
});
