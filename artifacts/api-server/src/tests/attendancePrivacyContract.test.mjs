import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Learner attendance views must never return staff notes or the recorder's
// identity (docs/legal/ZA_BW_SCOPED_ATTENDANCE.md). Runtime coverage:
// tests/integration/schoolOperations.integration.ts.
const routes = readFileSync(new URL("../routes/educationTalent.ts", import.meta.url), "utf8");
function handler(path) {
  const start = routes.indexOf(`router.get("${path}"`);
  assert.ok(start >= 0, `${path} must exist`);
  const next = routes.indexOf("\nrouter.", start + 1);
  return routes.slice(start, next < 0 ? undefined : next);
}

for (const path of ["/school/attendance/me", "/organizations/:orgId/attendance/me"]) {
  test(`${path} projects explicit columns and omits notes and recorder`, () => {
    const body = handler(path);
    assert.doesNotMatch(body, /db\.select\(\)\.from\(schoolAttendanceTable\)/, "no select-all");
    assert.doesNotMatch(body, /schoolAttendanceTable\.note|schoolAttendanceTable\.recordedBy/);
    assert.match(body, /eq\(schoolAttendanceTable\.learnerId,u(ser)?\)/);
  });
}
