// Browser UI tests use synthetic API fixtures; database permissions are tested separately.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CABO_CHROMIUM_PATH
    ? {
        executablePath: process.env.CABO_CHROMIUM_PATH,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      }
    : {}),
});
const base = process.env.CABO_UI_TEST_URL ?? "http://127.0.0.1:5180";
let created = false;
let testDeleted = false;
let teacher = false;
let savedFramework;
let uploadConsent;
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
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  let data;
  if (path === '/api/quizzes/99' && route.request().method() === 'DELETE') {
    testDeleted = true;
    await route.fulfill({ status: 204 });
    return;
  }
  if (path === '/api/quizzes') {
    await route.fulfill({status: 200, contentType:'application/json', body: JSON.stringify(testDeleted ? [] : [{id:99,title:'Deletion fixture',materialId:1,materialTitle:'Fractions',questionCount:10,optionCount:4,difficulty:'beginner',latestScore:null,createdAt:'2026-10-21T12:00:00Z'}])});
    return;
  }
  if (path === "/api/storage/uploads/request-url") {
    uploadConsent = route.request().postDataJSON().allowAiReading;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        uploadURL: base + "/api/mock-upload",
        objectPath: "/railway-uploads/demo",
      }),
    });
    return;
  }
  if (path === "/api/mock-upload") {
    await route.fulfill({ status: 204 });
    return;
  }
  if (path === "/api/materials" && route.request().method() === "POST") {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Some pages could not be read. Try a clearer copy.",
      }),
    });
    return;
  }

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
    data = [
      {
        id: 1,
        name: "CABO DEMO · Botswana pilot",
        role: teacher ? "admin" : "learner",
      },
      { id: 2, name: "Second school", role: "admin" },
    ];
  else if (path.endsWith("/support/options"))
    data = {
      role: teacher ? "admin" : "learner",
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
      items:
        new URL(route.request().url()).searchParams.get("after") === "100"
          ? [{ ...ticket, id: 101, concept: "Decimals" }]
          : [ticket],
      learningDNA: [
        {
          ticketId: 1,
          concept: "Fractions",
          courseId: 1,
          state: "demonstrated",
          reviewedAt: ticket.updatedAt,
        },
      ],
      nextCursor:
        new URL(route.request().url()).searchParams.get("after") === "100"
          ? null
          : 100,
      asOf: new Date().toISOString(),
      interpretation: "Observed progress, not a causal claim.",
    };
  else if (path.endsWith("/support/accountability"))
    data = {
      summary: { total: path.includes("/2/") ? 7 : 1 },
      asOf: new Date().toISOString(),
    };
  else if (path.endsWith("/education-framework")) {
    if (route.request().method() === "POST")
      savedFramework = route.request().postDataJSON();
    data = {
      canConfigure: teacher,
      current: {
        id: 1,
        countryCode: "ZA",
        frameworkCode: "CAPS",
        name: "Existing school curriculum",
        timeZone: "Africa/Johannesburg",
        languages: ["en", "zu"],
        settings: {
          levels: ["Grade 7", "Grade 8"],
          curriculumVersion: "2026",
          notes: "Keep school policy",
          gradingScale: [
            { label: "Pass", minimumPercent: 50 },
            { label: "Practise", minimumPercent: 0 },
          ],
        },
      },
    };
  } else if (path === "/api/materials") data = [];
  else data = {};
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
try {
  await page.goto(base + "/learner-success");
  await page.getByRole("heading", { name: "Let’s work through it." }).waitFor();
  await page.getByRole("combobox", { name: /^Subject/ }).selectOption("1");
  await page.getByLabel("Concept", { exact: true }).fill("Fractions");
  await page.getByLabel("What is difficult?").fill(ticket.question);
  await page.getByLabel("What have you tried?").fill(ticket.attempted);
  await page.getByRole("button", { name: "Ask an educator" }).click();
  await page.getByRole("heading", { name: "Fractions", exact: true }).waitFor();
  assert.ok(created);
  await page.getByRole("button", { name: "Get guided learning help" }).click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("textarea")).some((t) =>
      t.value.includes("Starter guidance — no AI used"),
    ),
  );
  await page.getByRole("button", { name: "Learning DNA", exact: true }).click();
  await page
    .getByRole("heading", { name: "Learning DNA", exact: true })
    .waitFor();
  await page.getByRole("heading", { name: "Fractions", exact: true }).waitFor();
  const accessibility = await new AxeBuilder({ page })
    .withRules([
      "button-name",
      "select-name",
      "label",
      "color-contrast",
      "aria-valid-attr-value",
      "image-alt",
    ])
    .analyze();
  assert.deepEqual(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    "Selected accessibility checks must pass",
  );
  await page
    .getByRole("button", { name: "Learner Passport", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load more progress records" })
    .click();
  await page.getByRole("heading", { name: "Decimals", exact: true }).waitFor();
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
  // Manager views use the school selector without leaving the active tab.
  teacher = true;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await page
    .getByRole("button", { name: "Intervention Accountability", exact: true })
    .click();
  await page.getByRole("combobox", { name: /^School/ }).selectOption("2");
  await page.getByText("7", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "School Framework", exact: true })
    .click();
  await page.getByLabel("School curriculum name", { exact: true }).waitFor();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("input")).some(
      (i) => i.value === "Existing school curriculum",
    ),
  );
  await page
    .getByRole("button", { name: "Save new framework version" })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "New framework version saved." })
    .waitFor();
  assert.equal(savedFramework.countryCode, "ZA");
  assert.deepEqual(savedFramework.settings.levels, ["Grade 7", "Grade 8"]);
  assert.equal(savedFramework.settings.notes, "Keep school policy");

  await page.goto(base + "/materials");
  await page.getByTestId("button-add-material").click();
  await page
    .getByTestId("input-material-file")
    .setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Fractions\nEquivalent fractions have the same value.",
      ),
    });
  await page.getByRole("checkbox").check();
  await page.getByTestId("button-upload-save").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Some pages could not be read. Try a clearer copy." })
    .waitFor();
  assert.equal(uploadConsent, true);
  assert.ok(
    (await page.getByTestId("input-material-title").inputValue()).includes(
      "notes",
    ),
  );
  assert.ok(!(await page.getByRole("alert").innerText()).includes("HTTP 400"));
  await page.goto(base + '/quizzes');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByTestId('button-delete-quiz-99').click();
  assert.equal(testDeleted, false);
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('button-delete-quiz-99').click();
  await page.getByText('No practice tests yet', {exact:true}).waitFor();
  assert.equal(testDeleted, true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: learner help form, queue/detail, guidance fallback, Learning DNA, passport download, 390px mobile layout, paginated passport history, school-scoped accountability, preserved framework revisions, six axe accessibility rules, upload consent and friendly errors with retained input, test deletion cancellation and confirmation, no browser runtime errors. API fixtures are synthetic.",
  );
} catch (error) {
  console.error((await page.locator("body").innerText()).slice(-6000));
  console.error("Browser errors:", errors);
  await page.screenshot({
    path: "/tmp/cabo-browser-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
