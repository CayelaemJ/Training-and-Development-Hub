import test from "node:test";
import assert from "node:assert/strict";
import {
  oidcRequestOrigin,
  permittedBrowserOrigin,
  permittedMutationOrigin,
  safeReturnPath,
  trustedOrigins
} from "../lib/originPolicy.ts";

const env = {
  NODE_ENV: "production",
  RAILWAY_PUBLIC_DOMAIN: "cabo-learner-hub-api-testing.up.railway.app",
  CABO_ALLOWED_ORIGINS: "https://school.example.org"
};

test("credentialed cross-origin requests are allowlisted, never reflected", () => {
  assert.equal(permittedBrowserOrigin("https://evil.invalid", env), false);
  assert.equal(permittedBrowserOrigin("https://school.example.org", env), true);
  assert.equal(permittedBrowserOrigin("https://cabo-learner-hub-api-testing.up.railway.app", env), true);
});

test("production disallows plaintext origins and malicious URL shapes", () => {
  const list = trustedOrigins({ ...env, CABO_ALLOWED_ORIGINS: "http://evil.invalid,https://user:pass@example.com,https://evil.invalid/path,https://safe.example" });
  assert.equal(list.has("http://evil.invalid"), false);
  assert.equal(list.has("https://safe.example"), true);
  assert.equal(list.has("https://evil.invalid"), false);
});

test("Render same-origin writes are trusted, unrelated origins rejected", () => {
  const render = { NODE_ENV: "production", RENDER_EXTERNAL_URL: "https://cabo-hub.onrender.com" };
  assert.equal(permittedBrowserOrigin("https://cabo-hub.onrender.com", render), true);
  assert.equal(permittedBrowserOrigin("https://other.onrender.com", render), false);
});

test("cookie-backed mutations require a trusted Origin or Referer", () => {
  const render = { NODE_ENV: "production", RENDER_EXTERNAL_URL: "https://cabo-hub.onrender.com" };
  assert.equal(permittedMutationOrigin({ origin: "https://cabo-hub.onrender.com", cookie: "sid=x" }, render), true);
  assert.equal(permittedMutationOrigin({ origin: "https://evil.invalid", cookie: "sid=x" }, render), false);
  assert.equal(permittedMutationOrigin({ referer: "https://cabo-hub.onrender.com/settings", cookie: "sid=x" }, render), true);
  assert.equal(permittedMutationOrigin({ referer: "https://evil.invalid/form", cookie: "sid=x" }, render), false);
  assert.equal(permittedMutationOrigin({ cookie: "sid=x" }, render), false);
});

test("origin-less native requests remain allowed only without browser cookies", () => {
  const render = { NODE_ENV: "production", RENDER_EXTERNAL_URL: "https://cabo-hub.onrender.com" };
  assert.equal(permittedMutationOrigin({}, render), true);
  assert.equal(permittedMutationOrigin({ origin: "" }, render), false);
  assert.equal(permittedMutationOrigin({ cookie: "sid=x" }, render), false);
});

test("OIDC callback origin uses only an approved request Host", () => {
  const render = { NODE_ENV: "production", RENDER_EXTERNAL_URL: "https://cabo-hub.onrender.com" };
  assert.equal(oidcRequestOrigin("cabo-hub.onrender.com", render), "https://cabo-hub.onrender.com");
  assert.equal(oidcRequestOrigin("CABO-HUB.ONRENDER.COM", render), "https://cabo-hub.onrender.com");
  assert.equal(oidcRequestOrigin("attacker.invalid", render), null);
  assert.equal(oidcRequestOrigin("cabo-hub.onrender.com:evil", render), null);
  assert.equal(oidcRequestOrigin(undefined, render), null);
});

test("OIDC return paths cannot change origin or inject URL separators or headers", () => {
  assert.equal(safeReturnPath("/learner?tab=progress"), "/learner?tab=progress");
  assert.equal(safeReturnPath("/"), "/");
  for (const value of [
    "https://evil.invalid/",
    "//evil.invalid/",
    "/\\evil.invalid",
    "/%2f%2fevil.invalid",
    "/%5cevil.invalid",
    "/%0d%0aLocation:%20https://evil.invalid"
  ]) assert.equal(safeReturnPath(value), "/");
});
