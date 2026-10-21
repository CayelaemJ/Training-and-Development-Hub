// Browser UI tests use synthetic API fixtures; database permissions are tested separately.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true });
const base = process.env.CABO_UI_TEST_URL ?? "http://127.0.0.1:5180";
let created = false;
const ticket = {
  id: 1,
  organizationId: 1,
  courseId: 1,
  concept: "Fractions",
  question: "How do I add unlike fractions?",
  attempted: "I tried adding denominators",
  status: "follow_up_required",
  assignedTo: "teacher-a",
  version: 1,
  reviewAt: "2027-01-01T12:00:00Z",
  feedback: null,
  outcome: { baseline: 42, followup: 72, improvementPp: 30 },
  createdAt: "2026-10-20T12:00:00Z",
  updatedAt: "2026-10-21T12:00:00Z",
};
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  let data;
  if (path === "/api/auth/user")
    data = {
      user: {
        id: "child-a",
        email: "child-a@example.invalid",
        firstName: "Demo",
        lastName: "Learner",
        profileImageUrl: null,
      },
    };
  else if (path === "/api/portal/me")
    data = { role: "learner", organizationIds: [1], scopes: [] };
  else if (path === "/api/organizations")
    data = [{ id: 1, name: "CABO DEMO · Botswana pilot", role: "learner" }];
  else if (path.endsWith("/support/options"))
    data = {
      role: "learner",
      courses: [{ id: 1, name: "Mathematics", level: "Form 1" }],
    };
  else if (
    path === "/api/organizations/1/support" &&
    route.request().method() === "POST"
  ) {
    created = true;
    data = ticket;
  } else if (path.endsWith("/support/1/guidance-draft"))
    data = {
      source: "non_ai_template",
      explanation: "Use equivalent denominators.",
      questions: ["What is the common denominator?"],
      practice: ["Try a similar example."],
    };
  else if (path.endsWith("/support/1"))
    data = {
      ticket,
      staff: false,
      owner: true,
      history: [
        {
          id: 1,
          kind: "reply",
          body: "Try equivalent denominators.",
          createdAt: ticket.createdAt,
          metadata: {},
        },
      ],
      educators: [],
      publishedResults: [],
    };
  else if (path === "/api/organizations/1/support")
    data = {
      items: created ? [ticket] : [],
      nextCursor: null,
      asOf: new Date().toISOString(),
    };
  else if (path === "/api/learner-passport/me")
    data = {
      items: [ticket],
      learningDNA: [
        {
          ticketId: 1,
          concept: "Fractions",
          courseId: 1,
          state: "demonstrated",
          reviewedAt: ticket.updatedAt,
        },
      ],
      nextCursor: null,
      asOf: new Date().toISOString(),
      interpretation: "Observed progress, not a causal claim.",
    };
  else data = {};
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
try {
  await page.goto(base + "/learner-success");
  await page
    .getByRole("heading", { name: "Your next breakthrough." })
    .waitFor();
  await page.getByLabel("Subject", { exact: true }).selectOption("1");
  await page.getByLabel("Concept", { exact: true }).fill("Fractions");
  await page.getByLabel("What is difficult?").fill(ticket.question);
  await page.getByLabel("What have you tried?").fill(ticket.attempted);
  await page.getByRole("button", { name: "Ask an educator" }).click();
  await page.getByRole("heading", { name: "Fractions", exact: true }).waitFor();
  assert.ok(created);
  await page.getByRole("button", { name: "Get guided learning help" }).click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("textarea")).some((t) =>
      t.value.includes("Non-AI learning template"),
    ),
  );
  await page.getByRole("button", { name: "Learning DNA", exact: true }).click();
  await page
    .getByRole("heading", { name: "Learning DNA", exact: true })
    .waitFor();
  await page.getByRole("heading", { name: "Fractions", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Learner Passport", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download private passport (JSON)" })
    .click();
  assert.equal(
    (await downloadEvent).suggestedFilename(),
    "cabo-learner-passport.json",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Learning DNA", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile layout must not overflow horizontally",
  );
  if (process.env.CABO_UI_SCREENSHOT)
    await page.screenshot({
      path: process.env.CABO_UI_SCREENSHOT,
      fullPage: true,
    });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: learner help form, queue/detail, guidance fallback, Learning DNA, passport download, 390px mobile layout, no browser runtime errors. API fixtures are synthetic.",
  );
} finally {
  await browser.close();
}
