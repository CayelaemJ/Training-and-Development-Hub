import test from "node:test";
import assert from "node:assert/strict";
import { screenMessage, screenNeedsCase, normaliseBody, mayPost, mayModerate, displayName, messageVisibleTo, withinRateLimit } from "../lib/classChatPolicy.ts";
import { REGIMES, UNSET_REGIME, regimeFor, suggestCountry, childMayConsentAlone } from "../lib/jurisdictionPolicy.ts";

test("ordinary schoolwork is shown at once", () => {
  for (const text of ["Who finished question 4?", "I got 3/4 for the fractions part", "See you in class tomorrow", "Page 12 of the textbook", "2026 exam timetable"])
    assert.deepEqual(screenMessage(text), { status: "visible" }, text);
});

test("contact details, links, off-platform invitations, abuse and self-harm language are held", () => {
  const cases = [
    ["my number is 071 234 5678", "phone_number"], ["call +267 71 234 567", "phone_number"],
    ["email me at kid@example.com", "email_address"], ["go to www.example.com", "link"],
    ["follow @coolkid99", "social_handle"], ["add me on WhatsApp", "off_platform_invite"],
    ["meet me after school, don't tell", "off_platform_invite"], ["kys", "abusive_language"],
    ["I want to die", "possible_self_harm"],
  ];
  for (const [text, reason] of cases) assert.deepEqual(screenMessage(text), { status: "held", reason }, text);
  assert.deepEqual(screenNeedsCase("possible_self_harm"), { kind: "safeguarding", severity: "high" });
  assert.equal(screenNeedsCase("link"), null);
});

test("message bodies are trimmed, bounded and stripped of invisible characters", () => {
  assert.equal(normaliseBody("  hi​ there  "), "hi there");
  assert.equal(normaliseBody(""), null);
  assert.equal(normaliseBody("x".repeat(1001)), null);
  assert.equal(normaliseBody({}), null);
  assert.equal(normaliseBody("a\n\n\n\nb"), "a\n\nb");
});

test("posting, moderation and visibility rules", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  const learner = { isLearner: true, isAssignedStaff: false, isSchoolLeader: false };
  const teacher = { isLearner: false, isAssignedStaff: true, isSchoolLeader: false };
  const outsider = { isLearner: false, isAssignedStaff: false, isSchoolLeader: false };
  assert.equal(mayPost(learner, true, null, now), true);
  assert.equal(mayPost(learner, false, null, now), false);
  assert.equal(mayPost(learner, true, new Date("2026-11-22T10:05:00Z"), now), false);
  assert.equal(mayPost(learner, true, new Date("2026-11-22T09:55:00Z"), now), true);
  assert.equal(mayPost(teacher, false, null, now), true);
  assert.equal(mayPost(outsider, true, null, now), false);
  assert.equal(mayModerate(learner), false);
  assert.equal(displayName("Lerato", "Mokoena", false), "Lerato M.");
  assert.equal(displayName("Tess", "Teacher", true), "Tess T. (teacher)");
  assert.equal(displayName(null, null, false), "Classmate");
  assert.equal(messageVisibleTo({ status: "held", authorId: "a" }, "a", false), "own_held");
  assert.equal(messageVisibleTo({ status: "held", authorId: "a" }, "b", false), "hidden");
  assert.equal(messageVisibleTo({ status: "hidden", authorId: "a" }, "a", false), "hidden");
  assert.equal(messageVisibleTo({ status: "hidden", authorId: "a" }, "b", true), "full");
  assert.equal(withinRateLimit(7), true);
  assert.equal(withinRateLimit(8), false);
});

test("the school's country selects POPIA or the Botswana DPA; unknown gets the strictest", () => {
  assert.equal(regimeFor("ZA"), REGIMES.ZA);
  assert.equal(regimeFor("BW"), REGIMES.BW);
  assert.equal(regimeFor(null), UNSET_REGIME);
  assert.equal(regimeFor("US"), UNSET_REGIME);
  assert.equal(REGIMES.BW.breachRegulatorHours.kind, "statutory");
  assert.equal(REGIMES.ZA.breachRegulatorHours.kind, "internal");
  assert.equal(UNSET_REGIME.childSelfConsentAge.value, null);
  assert.equal(UNSET_REGIME.localCopyOnTransfer.value, true);
  assert.ok(UNSET_REGIME.breachRegulatorHours.value <= Math.min(REGIMES.ZA.breachRegulatorHours.value, REGIMES.BW.breachRegulatorHours.value));
});

test("children's consent follows each country", () => {
  assert.equal(childMayConsentAlone(REGIMES.BW, 16), true);
  assert.equal(childMayConsentAlone(REGIMES.BW, 15), false);
  assert.equal(childMayConsentAlone(REGIMES.ZA, 17), false);
  assert.equal(childMayConsentAlone(REGIMES.ZA, 18), true);
  assert.equal(childMayConsentAlone(UNSET_REGIME, 17), false);
  assert.equal(childMayConsentAlone(REGIMES.BW, null), false, "unknown age needs a guardian");
});

test("time zone only suggests a country", () => {
  assert.equal(suggestCountry("Africa/Johannesburg"), "ZA");
  assert.equal(suggestCountry("Africa/Gaborone"), "BW");
  assert.equal(suggestCountry("Europe/London"), null);
  assert.equal(suggestCountry(undefined), null);
  assert.equal(suggestCountry("x".repeat(100)), null);
});
