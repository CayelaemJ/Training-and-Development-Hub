import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canReadChildReport } from "../lib/guardianPolicy.ts";

test("only institution-verified active guardians can read a child's progress", () => {
  for (const status of ["pending", "accepted", "declined", "revoked"])
    assert.equal(canReadChildReport(status, true, true), false);
  assert.equal(canReadChildReport("verified", false, true), false);
  assert.equal(canReadChildReport("verified", true, false), false);
  assert.equal(canReadChildReport("verified", true, true), true);
});

test("native report API enforces session and school verification", () => {
  const route = readFileSync("artifacts/api-server/src/routes/nativeParent.ts", "utf8");
  for (const expected of [
    'router.get("/native/mobile/parent/reports"',
    'nativeAuthEnabled(process.env)',
    'startsWith("Bearer ")',
    'session?.access_token !== "cabo-native-session-v1"',
    'eq(guardianRelationshipsTable.guardianId, req.user.id)',
    'eq(guardianRelationshipsTable.status, "verified")',
    'eq(verifiedEnrollmentsTable.status, "active")',
    'eq(guardianVerificationEventsTable.organizationId, organizationId)',
    'canReadChildReport("verified", event?.decision === "verified", true)',
    'official: false, status: "draft_preview"',
  ]) assert.ok(route.includes(expected), expected);
});

test("native apps use server-scoped reports, not mock grades", () => {
  const ios = readFileSync("native-apps/ios/NativeSession.swift", "utf8");
  const android = readFileSync("native-apps/android/app/src/main/java/za/co/cabosolutions/learninghub/NativeApi.kt", "utf8");
  assert.ok(ios.includes("api/native/mobile/parent/reports"));
  assert.ok(android.includes("api/native/mobile/parent/reports"));
  assert.ok(!ios.includes("UserDefaults.standard.set(guardianReports"));
  assert.ok(!android.includes('secrets.put("guardianReports"'));
});
