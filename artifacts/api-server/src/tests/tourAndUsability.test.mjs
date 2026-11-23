import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(p, "utf8");
const app = read("artifacts/training-platform/src/App.tsx");
const tour = read("artifacts/training-platform/src/pages/tour.tsx");
const jump = read("artifacts/training-platform/src/components/quick-jump.tsx");
const celebrate = read("artifacts/training-platform/src/components/celebrate.tsx");
const toggle = read("artifacts/training-platform/src/components/theme-toggle.tsx");
const css = read("artifacts/training-platform/src/index.css");

test("the tour is routed and visible to every signed-in role", () => {
  assert.match(app, /<Route path="\/tour" component=\{TourPage\} \/>/);
  assert.match(app, /const alwaysNav=\['\/tour',/);
  assert.match(app, /href: '\/tour', label: 'Tour CABO'/);
});

test("the tour names demo usernames but never a password", () => {
  assert.match(tour, /cabo_learner_south_a/);
  assert.doesNotMatch(tour, /password|12345/i);
  assert.match(tour, /\/api\/healthz\/ai/, "shows live AI status");
});

test("quick jump only lists pages the person may open", () => {
  assert.match(app, /<QuickJump items=\{navItems\.filter\(item=>alwaysNav\.includes\(item\.href\)\|\|allowedNav\[portalRole\]\?\.includes\(item\.href\)\)/);
  assert.match(jump, /e\.ctrlKey \|\| e\.metaKey/);
  assert.match(jump, /role="dialog" aria-modal="true"/);
});

test("the celebration respects reduced motion and is hidden from screen readers", () => {
  assert.match(celebrate, /cabo-reduce-motion/);
  assert.match(celebrate, /prefers-reduced-motion: reduce/);
  assert.match(celebrate, /aria-hidden="true"/);
  assert.match(css, /\.cabo-reduce-motion \.celebrate \{ display:none; \}/);
});

test("the theme toggle saves only the appearance fields the server accepts", () => {
  for (const key of ["theme", "accent", "fontScale", "density", "font", "highContrast", "reduceMotion", "underlineLinks", "captionsDefault", "pinned"]) assert.match(toggle, new RegExp(key + ":"));
  assert.match(toggle, /\/api\/me\/appearance/);
});
