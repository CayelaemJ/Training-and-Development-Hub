#!/usr/bin/env node
// One-shot end-to-end guardian approval/revocation smoke for the isolated Render preview.
// It deliberately leaves its synthetic relationship revoked; reseed the isolated Neon DB to repeat.
// No credentials, learner IDs, names, or response bodies are printed.
const origin = process.env.CABO_TEST_BASE_URL;
const adminPassword = process.env.CABO_TEST_PASSWORD;
const parentPassword = process.env.CABO_TEST_PARENT_PASSWORD;
const expectedHost = "cabo-learning-native-isolated-preview.onrender.com";

let base;
try {
  base = new URL(origin || "");
  if (base.protocol !== "https:" || base.hostname !== expectedHost || base.username ||
      base.password || base.pathname !== "/" || base.search || base.hash) throw Error();
} catch {
  console.error("Configure CABO_TEST_BASE_URL to the isolated Render preview host.");
  process.exit(1);
}
for (const [key, value] of [["CABO_TEST_PASSWORD", adminPassword], ["CABO_TEST_PARENT_PASSWORD", parentPassword]]) {
  if (typeof value !== "string" || value.length < 12) {
    console.error(`Set ${key} privately; no password is supplied by this script.`);
    process.exit(1);
  }
}

const url = (path) => new URL(path, base).toString();
const timeout = () => AbortSignal.timeout(15000);
async function request(path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(url(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: timeout(),
  });
}
async function login(username, password) {
  const response = await request("/api/native/test-login", {
    method: "POST", body: { username, password },
  });
  if (response.status !== 200) throw Error("login");
  const session = await response.json();
  if (session.token_type !== "Bearer" || !/^[a-f0-9]{64}$/.test(session.access_token ?? "")) {
    throw Error("session");
  }
  return session.access_token;
}
async function json(path, token) {
  const response = await request(path, { token });
  if (response.status !== 200) throw Error("read");
  return response.json();
}
function assert(condition, label) {
  if (!condition) throw Error(label);
}
function noIdentity(row) {
  return row?.learnerName === null && row?.verifiedForRead === false &&
    !Object.hasOwn(row, "learnerId");
}

let adminToken;
let parentToken;
let stage = "sign-in";
try {
  adminToken = await login("cabo_test", adminPassword);
  parentToken = await login("cabo_parent_south", parentPassword);
  const admin = { token: adminToken };

  stage = "find synthetic accepted relationship";
  const overview = await json("/api/platform/overview", adminToken);
  assert(Array.isArray(overview.organizations), "organization registry");
  const demoOrganizations = overview.organizations.filter(item =>
    Number.isSafeInteger(item.id) && typeof item.name === "string" && item.name.startsWith("[DEMO] "));
  let fixture;
  for (const organization of demoOrganizations) {
    const reviews = await json(`/api/organizations/${organization.id}/guardian-reviews`, adminToken);
    if (!Array.isArray(reviews)) continue;
    const relation = reviews.find(item => item.guardianId === "cabo-fixture-parent-south" && item.status === "accepted");
    if (!relation) continue;
    const enrollments = await json(`/api/organizations/${organization.id}/verified-enrollments`, adminToken);
    const enrollment = Array.isArray(enrollments) && enrollments.find(item =>
      item.learnerId === relation.learnerId && item.status === "active");
    if (enrollment) {
      fixture = { organizationId: organization.id, relation, enrollment };
      break;
    }
  }
  assert(fixture, "accepted synthetic guardian fixture unavailable; reseed the isolated database");

  stage = "check pre-approval redaction";
  const before = await json("/api/native/mobile/parent", parentToken);
  const beforeRow = before.relationships?.find(item => item.invitationId === fixture.relation.id);
  assert(beforeRow?.status === "accepted" && noIdentity(beforeRow), "pre-approval redaction");

  stage = "approve at the fixture school";
  const approved = await request(
    `/api/organizations/${fixture.organizationId}/guardian-reviews/${fixture.relation.id}`,
    { method: "POST", token: admin.token, body: { decision: "verified", evidenceReviewed: true } },
  );
  assert(approved.status === 200, "school approval");

  stage = "check approved learner name";
  const afterApproval = await json("/api/native/mobile/parent", parentToken);
  const approvedRow = afterApproval.relationships?.find(item => item.invitationId === fixture.relation.id);
  assert(approvedRow?.status === "verified" && approvedRow.verifiedForRead === true &&
    typeof approvedRow.learnerName === "string" && approvedRow.learnerName.length > 0 &&
    !Object.hasOwn(approvedRow, "learnerId"), "approved name disclosure");

  stage = "check approved report reads";
  const learnerPath = encodeURIComponent(fixture.relation.learnerId);
  const query = `organizationId=${fixture.organizationId}&year=${fixture.enrollment.academicYear}`;
  const report = await request(`/api/guardian/reports/${learnerPath}?${query}`, { token: parentToken });
  assert(report.status === 200, "approved guardian report");
  const issued = await request(
    `/api/guardian/issued-reports/${learnerPath}?organizationId=${fixture.organizationId}`,
    { token: parentToken },
  );
  assert(issued.status === 200, "approved issued-report list");

  stage = "revoke at the fixture school";
  const revoked = await request(
    `/api/organizations/${fixture.organizationId}/guardian-reviews/${fixture.relation.id}`,
    { method: "POST", token: admin.token, body: { decision: "revoked", evidenceReviewed: true } },
  );
  assert(revoked.status === 200, "school revocation");

  stage = "check redaction and report denial after revocation";
  const afterRevocation = await json("/api/native/mobile/parent", parentToken);
  const revokedRow = afterRevocation.relationships?.find(item => item.invitationId === fixture.relation.id);
  assert(revokedRow?.status === "revoked" && noIdentity(revokedRow), "post-revocation redaction");
  const deniedReport = await request(`/api/guardian/reports/${learnerPath}?${query}`, { token: parentToken });
  const deniedIssued = await request(
    `/api/guardian/issued-reports/${learnerPath}?organizationId=${fixture.organizationId}`,
    { token: parentToken },
  );
  assert(deniedReport.status === 403 && deniedIssued.status === 403, "post-revocation report denial");

  stage = "logout and token revocation";
  const parentLogout = await request("/api/native/logout", { method: "POST", token: parentToken, body: {} });
  const adminLogout = await request("/api/native/logout", { method: "POST", token: adminToken, body: {} });
  assert(parentLogout.status === 204 && adminLogout.status === 204, "logout");
  const retry = await request("/api/native/mobile/parent", { token: parentToken });
  assert(retry.status === 401, "session revocation");
  console.log("PASS: accepted redaction, school approval disclosure, guardian report access, revocation denial, and logout.");
  console.log("NOTE: the synthetic relationship was left revoked; reseed the isolated database before repeating this smoke.");
} catch {
  console.error(`FAIL: isolated guardian school-review smoke at stage: ${stage}`);
  process.exitCode = 1;
} finally {
  adminToken = undefined;
  parentToken = undefined;
}
