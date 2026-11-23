#!/usr/bin/env node
/**
 * Generate environment-only web test logins for synthetic CABO fixture users.
 * No password or hash is checked into Git. Never run against live data.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`CABO demo login generator: ${message}\n`);
  process.exit(1);
}

if (process.env.CABO_ENVIRONMENT !== "testing" ||
    process.env.CABO_TEST_DATABASE_ISOLATED !== "true" ||
    process.env.NODE_ENV === "production") {
  fail("requires CABO_ENVIRONMENT=testing, CABO_TEST_DATABASE_ISOLATED=true, and a non-production process");
}

const password = process.env.CABO_DEMO_PASSWORD;
if (typeof password !== "string" || password.length === 0 || password.length > 200) {
  fail("set CABO_DEMO_PASSWORD to a non-empty password of at most 200 characters");
}
if (password.length < 12 && process.env.CABO_ALLOW_WEAK_DEMO_PASSWORD !== "true") {
  fail("short demo passwords require explicit CABO_ALLOW_WEAK_DEMO_PASSWORD=true");
}

const seed = readFileSync(new URL("../artifacts/api-server/src/lib/demoSeed.ts", import.meta.url), "utf8");
const peopleBlock = seed.match(/const people = \[([\s\S]*?)\] as const;/);
if (!peopleBlock) fail("cannot locate fixture identities; no credentials generated");

const people = [...peopleBlock[1].matchAll(/\[\s*"([a-z0-9-]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g)];
if (people.length === 0) fail("fixture identity list is empty");
const usernames = new Set();
const identities = [];
for (const [, key, firstName, lastName] of people) {
  const username = `cabo_${key.replaceAll("-", "_")}`;
  const userId = `cabo-fixture-${key}`;
  if (!/^cabo_(?:headmaster|teacher|assessor|learner|parent|district|university|company)_[a-z0-9_]{2,20}$/.test(username) ||
      !/^cabo-fixture-[a-z0-9-]{3,60}$/.test(userId) || usernames.has(username)) {
    fail(`fixture principal is incompatible with test-login policy: ${key}`);
  }
  usernames.add(username);
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  identities.push({
    username, userId, email: `${key}@example.invalid`, firstName, lastName,
    hash: `${salt.toString("hex")}:${hash.toString("hex")}`,
  });
}

// Output contains hashes and synthetic identifiers, never the plaintext password.
// Set the whole output as CABO_TEST_USERS_JSON on an isolated test service only.
process.stdout.write(JSON.stringify(identities) + "\n");
