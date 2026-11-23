import { scryptSync, timingSafeEqual } from "node:crypto";

type TestEnvironment = Record<string, string | undefined>;

/** Default minimum for any test/demo password verifier. */
export const STANDARD_TEST_PASSWORD_MIN = 12;
/** Shorter minimum, only for presentation demos on an isolated synthetic database. */
export const DEMO_SHORT_PASSWORD_MIN = 5;
export const TEST_PASSWORD_MAX = 200;

/**
 * Short demo passwords are allowed only when the service is a testing deployment,
 * its database has been marked isolated (synthetic data only), and an operator
 * has opted in explicitly. A public pilot or school deployment never qualifies.
 */
export function demoShortPasswordsAllowed(env: TestEnvironment): boolean {
  return (env.CABO_ENVIRONMENT ?? env.RAILWAY_ENVIRONMENT_NAME) === "testing" &&
    env.CABO_TEST_DATABASE_ISOLATED === "true" &&
    env.CABO_DEMO_SHORT_PASSWORDS === "true";
}

export function testPasswordLengthAcceptable(password: unknown, env: TestEnvironment): password is string {
  if (typeof password !== "string") return false;
  const min = demoShortPasswordsAllowed(env) ? DEMO_SHORT_PASSWORD_MIN : STANDARD_TEST_PASSWORD_MIN;
  return password.length >= min && password.length <= TEST_PASSWORD_MAX;
}

/** Extra opt-in guard: a public deployment is never automatically a test tenant. */
export function nativeTestLoginEnabled(env: TestEnvironment): boolean {
  return (env.CABO_ENVIRONMENT ?? env.RAILWAY_ENVIRONMENT_NAME) === "testing" &&
    env.CABO_TEST_DATABASE_ISOLATED === "true" &&
    env.ENABLE_CABO_TEST_LOGIN === "true" &&
    env.ENABLE_CABO_NATIVE_TEST_LOGIN === "true" &&
    env.CABO_TEST_LOGIN_USERNAME === "cabo_test";
}

/** Match a pinned test username and a salted scrypt hash; never embed passwords. */
export function verifyNativeTestLogin(username: unknown, password: unknown, env: TestEnvironment): boolean {
  if (!nativeTestLoginEnabled(env) || username !== "cabo_test" ||
      !testPasswordLengthAcceptable(password, env)) return false;
  const [salt, hash] = (env.CABO_TEST_PASSWORD_HASH ?? "").split(":");
  if (!/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(hash ?? "")) return false;
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
