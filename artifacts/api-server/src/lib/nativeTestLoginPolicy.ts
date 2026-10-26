import { scryptSync, timingSafeEqual } from "node:crypto";

type TestEnvironment = Record<string, string | undefined>;
type TestPrincipal = { username: string; hash: string };

/** Extra opt-in guard: a public deployment is never automatically a test tenant. */
export function nativeTestLoginEnabled(env: TestEnvironment): boolean {
  return (env.CABO_ENVIRONMENT ?? env.RAILWAY_ENVIRONMENT_NAME) === "testing" &&
    env.CABO_TEST_DATABASE_ISOLATED === "true" &&
    env.ENABLE_CABO_TEST_LOGIN === "true" &&
    env.ENABLE_CABO_NATIVE_TEST_LOGIN === "true" &&
    env.CABO_TEST_LOGIN_USERNAME === "cabo_test";
}

/** Match the pinned superadmin or a validated synthetic principal to a salted hash. */
export function verifyNativeTestLogin(
  username: unknown,
  password: unknown,
  env: TestEnvironment,
  fixture?: TestPrincipal,
): boolean {
  if (!nativeTestLoginEnabled(env) || typeof username !== "string" ||
      typeof password !== "string" || password.length < 12 || password.length > 200) return false;
  const isPinnedAdmin = username === "cabo_test" && !fixture;
  if (!isPinnedAdmin && (!fixture || fixture.username !== username)) return false;
  const [salt, hash] = (fixture?.hash ?? env.CABO_TEST_PASSWORD_HASH ?? "").split(":");
  if (!/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(hash ?? "")) return false;
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
