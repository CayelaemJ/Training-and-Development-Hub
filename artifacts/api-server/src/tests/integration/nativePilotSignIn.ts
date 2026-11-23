import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import cookieParser from "cookie-parser";
import express from "express";
import { NATIVE_CLIENTS } from "../../lib/nativeAuthPolicy";
import { authMiddleware } from "../../middlewares/authMiddleware";
import authRouter from "../../routes/auth";
import nativeAuthRouter from "../../routes/nativeAuth";
import supportRouter from "../../routes/learnerSupport";
import { engine } from "./supportTestDb";

export async function verifyNativePilotSignIn() {
  const username = "cabo_learner_native_ci";
  const userId = "cabo-fixture-native-ci";
  const password = randomBytes(24).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex");

  // The caller owns this in-memory database. No remote service is contacted.
  await engine.exec(`
    ALTER TABLE users ADD COLUMN email varchar UNIQUE, ADD COLUMN profile_image_url varchar,
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    CREATE TABLE sessions(sid varchar PRIMARY KEY, sess jsonb NOT NULL, expire timestamp NOT NULL);
    INSERT INTO users(id) VALUES ('${userId}');
    INSERT INTO organization_members(organization_id,user_id,role) VALUES (1,'${userId}','learner');
    INSERT INTO academic_enrollments(course_id,user_id) VALUES (1,'${userId}');
  `);
  await engine.exec(await readFile("lib/db/migrations/20261022_native_auth_codes.sql", "utf8"));

  const configuration = {
    CABO_ENVIRONMENT: "testing",
    CABO_TEST_DATABASE_ISOLATED: "true",
    ENABLE_CABO_TEST_LOGIN: "true",
    CABO_NATIVE_AUTH_ENABLED: undefined,
    NODE_ENV: "test",
    PORT: undefined,
    CABO_TEST_USERS_JSON: JSON.stringify([{
      username, userId, hash: `${salt}:${hash}`,
      firstName: "Synthetic", lastName: "Learner", email: "native-ci@example.invalid",
    }]),
  };
  const previous = Object.fromEntries(Object.keys(configuration).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(configuration)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const app = express();
  app.use(cookieParser(), express.json(), authMiddleware);
  app.use("/api", authRouter, nativeAuthRouter, supportRouter);
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.PORT = String((server.address() as AddressInfo).port);
    const call = (path: string, init?: RequestInit) => fetch(origin + path, {
      ...init, redirect: "manual", signal: AbortSignal.timeout(5000),
    });
    const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
      call(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const continuationCookie = (response: Response) => {
      const cookie = response.headers.getSetCookie().find(value => value.startsWith("sid="));
      if (!cookie) throw new Error("Demo login did not set a browser session.");
      return cookie.split(";", 1)[0];
    };

    const web = await post("/api/test-login", { username, password });
    assert.equal(web.status, 200);
    const webHeaders = { Cookie: continuationCookie(web) };
    const resource = "/api/organizations/1/support";
    const created = await post(resource, {
      courseId: 1, concept: "Fractions", question: "How should I add these unlike fractions?",
      attempted: "I tried adding the denominators.", requestKey: randomUUID(),
    }, webHeaders);
    assert.equal(created.status, 201);
    const { id } = await created.json();

    for (const [clientId, callback] of Object.entries(NATIVE_CLIENTS)) {
      const verifier = randomBytes(48).toString("base64url");
      const state = randomBytes(32).toString("base64url");
      const params = new URLSearchParams({
        client_id: clientId, state, code_challenge_method: "S256",
        code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      });
      const authorize = "/api/native/authorize?" + params;
      const enter = await call(authorize);
      assert.equal(enter.status, 302, clientId);
      const login = enter.headers.get("Location") ?? "";
      assert.equal(new URL(login, origin).pathname, "/api/login");
      const landing = await call(login);
      assert.equal(landing.status, 302, clientId);
      const nativeReturnTo = new URL(landing.headers.get("Location") ?? "", origin).searchParams.get("nativeReturnTo");
      assert.equal(nativeReturnTo, authorize);

      const signedIn = await post("/api/test-login", { username, password, nativeReturnTo });
      assert.equal(signedIn.status, 200);
      const { redirectTo } = await signedIn.json();
      assert.equal(redirectTo, authorize);
      const approved = await call(redirectTo, { headers: { Cookie: continuationCookie(signedIn) } });
      assert.equal(approved.status, 302);
      const handoff = new URL(approved.headers.get("Location") ?? "");
      assert.equal(handoff.href.split("?")[0], callback);
      assert.equal(handoff.searchParams.get("state"), state);

      const request = { client_id: clientId, code: handoff.searchParams.get("code"), code_verifier: verifier };
      const issued = await post("/api/native/token", request);
      assert.equal(issued.status, 200, clientId);
      const { access_token } = await issued.json();
      const headers = { Authorization: "Bearer " + access_token };
      assert.equal((await post("/api/native/token", request)).status, 400, clientId);
      const read = await call(`${resource}/${id}`, { headers });
      assert.equal(read.status, 200, clientId);
      assert.equal((await read.json()).id, id, clientId);
      assert.equal((await call("/api/organizations/2/support", { headers })).status, 403, clientId);
      assert.equal((await post("/api/native/logout", {}, headers)).status, 204, clientId);
      assert.equal((await call(`${resource}/${id}`, { headers })).status, 401, clientId);
    }
    console.log("PASS: web and three native PKCE clients share one support record. Cross-school access, code replay and revoked sessions were rejected.");
  } finally {
    server.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
