#!/usr/bin/env node
// Local operator helper for CABO's ISOLATED dummy-data test environment.
// Run with CABO_TEST_SETUP_PASSWORD set by the operator in a secure terminal.
// This script NEVER records or prints the password or commits credentials.
import { randomBytes, scryptSync } from "node:crypto";

const password = process.env.CABO_TEST_SETUP_PASSWORD;
if (typeof password !== "string" || password.length < 12) {
  process.stderr.write("Set CABO_TEST_SETUP_PASSWORD (12+ characters) securely, then rerun.\n");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64).toString("hex");
const lines = [
  "For an isolated, disposable CABO pilot with dummy learner records ONLY:",
  "CABO_ENVIRONMENT=testing",
  "ENABLE_CABO_TEST_LOGIN=true",
  "CABO_TEST_LOGIN_USERNAME=cabo_test",
  "CABO_TEST_PASSWORD_HASH=" + salt.toString("hex") + ":" + hash,
  "ENABLE_CABO_SUPERADMIN=true",
  "CABO_SUPERADMIN_USER_ID=cabo-isolated-test-learner",
  "",
  "Store these as private Render environment variables, not in GitHub or an app build.",
  "The superadmin gate MUST remain disabled in all school/production deployments.",
  "Rotate this credential after testing; treat any copied output as sensitive."
];
process.stdout.write(lines.join("\n") + "\n");
