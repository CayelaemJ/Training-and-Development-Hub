import test from "node:test";
import assert from "node:assert/strict";
import { sniffImage, photoNeedsGuardian, mayViewPhoto, cleanText, initials } from "../lib/profilePolicy.ts";

test("images are identified by their bytes", () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffImage(new TextEncoder().encode("RIFF1234WEBPVP8 ")), "image/webp");
  assert.equal(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(sniffImage(new Uint8Array([])), null);
});
test("learner photos need a guardian; staff and visibility rules", () => {
  assert.equal(photoNeedsGuardian(["learner"]), true);
  assert.equal(photoNeedsGuardian(["learner", "teacher"]), false);
  assert.equal(photoNeedsGuardian([]), false);
  const base = { viewerId: "v", ownerId: "o", sharesSchool: true, isGuardian: false };
  assert.equal(mayViewPhoto({ ...base, status: "pending_guardian" }), false);
  assert.equal(mayViewPhoto({ ...base, status: "approved" }), true);
  assert.equal(mayViewPhoto({ ...base, status: "approved", sharesSchool: false }), false);
  assert.equal(mayViewPhoto({ ...base, status: "pending_guardian", isGuardian: true, sharesSchool: false }), true);
  assert.equal(mayViewPhoto({ ...base, status: "declined", isGuardian: true }), false);
  assert.equal(mayViewPhoto({ ...base, viewerId: "o", status: "declined" }), true);
});
test("free text is short, clean and contact-free; initials", () => {
  assert.equal(cleanText("  Hello   there ", 60), "Hello there");
  assert.equal(cleanText("x".repeat(61), 60), null);
  assert.equal(cleanText("follow @someone", 60), null);
  assert.equal(cleanText(5, 60), null);
  assert.equal(initials("", "Lerato", "Mokoena"), "LM");
  assert.equal(initials("Lera", null, null), "LE");
});
