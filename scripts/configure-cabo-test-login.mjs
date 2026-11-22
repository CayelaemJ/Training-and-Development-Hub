#!/usr/bin/env node
// Local operator helper for CABO's ISOLATED dummy-data test environment.
// Run with CABO_TEST_SETUP_PASSWORD set by the operator in a secure terminal.
// This script NEVER records or prints the password or commits credentials.
//
// By default the password must be 12+ characters. For a presentation demo on an
// isolated synthetic database only, set CABO_DEMO_SHORT_PASSWORDS=true to allow
// 5+ characters; the server enforces the same rule (lib/testPasswordPolicy.ts).
import { randomBytes, scryptSync } from "node:crypto";

// Mirrors the 13 fictional identities created by lib/demoSeed.ts.
const DEMO_FIXTURES = [
  ["headmaster-south", "Nomsa", "Dube"],
  ["teacher-south", "Thabo", "Maseko"],
  ["assessor-south", "Palesa", "Mokoena"],
  ["learner-south-a", "Lerato", "Mahlobo"],
  ["learner-south-b", "Sipho", "Khumalo"],
  ["parent-south", "Mpho", "Mahlobo"],
  ["district-south", "Zanele", "Nkosi"],
  ["university-head", "Dr Nandi", "Molefe"],
  ["university-teacher", "Bongani", "Zulu"],
  ["university-learner", "Ayanda", "Mthembu"],
  ["company-head", "Karabo", "Pillay"],
  ["headmaster-north", "Musa", "Mabena"],
  ["learner-north", "Sihle", "Naidoo"],
];

const shortAllowed = process.env.CABO_DEMO_SHORT_PASSWORDS === "true";
const minimum = shortAllowed ? 5 : 12;
const password = process.env.CABO_TEST_SETUP_PASSWORD;
if (typeof password !== "string" || password.length < minimum) {
  process.stderr.write(`Set CABO_TEST_SETUP_PASSWORD (${minimum}+ characters) securely, then rerun.\n`);
  process.exit(1);
}

/** Each principal gets its own random salt, so no two verifiers are identical. */
function verifier(secret) {
  const salt = randomBytes(16);
  return salt.toString("hex") + ":" + scryptSync(secret, salt, 64).toString("hex");
}

function demoPrincipals(secret) {
  return DEMO_FIXTURES.map(([key, firstName, lastName]) => ({
    username: "cabo_" + key.replaceAll("-", "_"),
    userId: "cabo-fixture-" + key,
    email: key + "@example.invalid",
    firstName,
    lastName,
    hash: verifier(secret),
  }));
}

const lines = [
  "For an isolated, disposable CABO pilot with dummy learner records ONLY:",
  "CABO_ENVIRONMENT=testing",
  "ENABLE_CABO_TEST_LOGIN=true",
  "ENABLE_CABO_NATIVE_TEST_LOGIN=true",
  "CABO_TEST_LOGIN_USERNAME=cabo_test",
  "CABO_TEST_PASSWORD_HASH=" + verifier(password),
  "ENABLE_CABO_SUPERADMIN=true",
  "CABO_SUPERADMIN_USER_ID=cabo-isolated-test-learner",
];
if (process.argv.includes("--all-demo-roles")) {
  lines.push("CABO_TEST_USERS_JSON=" + JSON.stringify(demoPrincipals(password)));
}
if (shortAllowed) lines.push("CABO_DEMO_SHORT_PASSWORDS=true");
lines.push(
  "",
  "Store these as private Render environment variables, not in GitHub or an app build.",
  "The superadmin gate MUST remain disabled in all school/production deployments.",
  "BEFORE using these credentials, verify a separate disposable database and set CABO_TEST_DATABASE_ISOLATED=true manually.",
  "Never set the isolated-database flag on a real school service.",
  "Rotate this credential after testing; treat any copied output as sensitive.",
);
process.stdout.write(lines.join("\n") + "\n");
