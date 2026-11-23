// Profiles, appearance and display pictures over HTTP against PGlite built
// from the real schema plus the reviewed migration.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import profileRouter from "../../routes/profile";
import { engine } from "./supportTestDb";
import { createSchemaFromDrizzle } from "./schemaFromDrizzle";

await createSchemaFromDrizzle();
await engine.exec("DROP TABLE profile_photos, user_appearance, user_profiles CASCADE");
await engine.exec(readFileSync("lib/db/migrations/20261123_profiles_and_appearance.sql", "utf8"));
await engine.exec(`
INSERT INTO users(id,email,first_name,last_name) VALUES ('owner','o@s.test','Olga','Owner'),('kid','k@s.test','Lerato','Mokoena'),
 ('mate','m@s.test','Sipho','Khumalo'),('teacher','t@s.test','Tess','Teacher'),('parent','p@f.test','Grace','Guardian'),('other','x@o.test','Otto','Other'),('owner2','o2@s.test','Two','Owner');
INSERT INTO organizations(id,name,owner_id) VALUES (1,'School 1','owner'),(2,'School 2','owner2');
INSERT INTO organization_members(organization_id,user_id,role) VALUES (1,'owner','owner'),(1,'kid','learner'),(1,'mate','learner'),(1,'teacher','teacher'),(2,'other','learner'),(2,'owner2','owner');
INSERT INTO guardian_relationships(learner_id,guardian_id,status) VALUES ('kid','parent','verified');
`);
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.user = req.headers["x-test-user"] ? ({ id: String(req.headers["x-test-user"]) } as any) : undefined; req.isAuthenticated = (() => !!req.user) as any; next(); });
app.use("/api", profileRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(r => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
async function call(user: string, method: string, path: string, body?: unknown, type = "application/json"): Promise<{ status: number; data: any }> {
  const r = await fetch(base + path, { method, headers: { ...(user ? { "x-test-user": user } : {}), ...(body !== undefined ? { "content-type": type } : {}) }, body: body === undefined ? undefined : type === "application/json" ? JSON.stringify(body) : (body as any) });
  const text = await r.text();
  let data: any = text; try { data = JSON.parse(text); } catch { /* binary */ }
  return { status: r.status, data };
}
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
let failures = 0, passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`ok - ${name}`); } catch (e) { failures++; console.log(`not ok - ${name}`); console.log(e); }
}
try {
  await check("defaults, then profile and appearance are saved and validated", async () => {
    const first = await call("kid", "GET", "/me/profile");
    assert.equal(first.data.profile.initials, "LM");
    assert.equal(first.data.appearance.theme, "system");
    assert.equal((await call("kid", "PUT", "/me/profile", { displayName: "Lera", pronouns: "she/her", bio: "Loves maths", avatarStyle: "pattern", avatarColor: "violet" })).status, 200);
    assert.equal((await call("kid", "PUT", "/me/profile", { bio: "find me at www.example.com" })).status, 400, "no links");
    assert.equal((await call("kid", "PUT", "/me/profile", { bio: "call 071 234 5678" })).status, 400, "no phone numbers");
    const look = { theme: "dark", accent: "teal", fontScale: 1.25, density: "spacious", font: "easy_read", highContrast: true, reduceMotion: true, underlineLinks: true, captionsDefault: true, pinned: ["/class-chat", "/materials"] };
    assert.equal((await call("kid", "PUT", "/me/appearance", look)).status, 200);
    assert.equal((await call("kid", "PUT", "/me/appearance", { ...look, fontScale: 3 })).status, 400);
    assert.equal((await call("kid", "PUT", "/me/appearance", { ...look, pinned: ["javascript:alert(1)"] })).status, 400);
    const after = (await call("kid", "GET", "/me/profile")).data;
    assert.equal(after.profile.name, "Lera");
    assert.deepEqual([after.appearance.theme, after.appearance.font, after.appearance.pinned], ["dark", "easy_read", ["/class-chat", "/materials"]]);
    assert.equal((await call("", "GET", "/me/profile")).status, 401);
  });
  let url = "";
  await check("a learner's photo waits for the guardian and is hidden from classmates until approved", async () => {
    assert.equal((await call("kid", "PUT", "/me/photo", Buffer.from("not an image at all"), "image/png")).status, 400, "magic bytes checked");
    const up = await call("kid", "PUT", "/me/photo", png, "image/png");
    assert.equal(up.data.status, "pending_guardian");
    url = (await call("kid", "GET", "/me/profile")).data.photo.url.replace("/api", "");
    assert.equal((await call("kid", "GET", url)).status, 200, "the owner sees it");
    assert.equal((await call("mate", "GET", url)).status, 404, "classmate before approval");
    const pending = await call("parent", "GET", "/me/photo-approvals");
    assert.equal(pending.data.length, 1);
    assert.equal((await call("parent", "GET", url)).status, 200, "guardian can review it");
    assert.equal((await call("mate", "POST", "/me/photo-approvals/kid", { decision: "approved" })).status, 404, "only the guardian decides");
    assert.equal((await call("parent", "POST", "/me/photo-approvals/kid", { decision: "approved" })).status, 200);
    assert.equal((await call("mate", "GET", url)).status, 200, "classmate after approval");
    assert.equal((await call("other", "GET", url)).status, 404, "another school never");
  });
  await check("staff photos show at once; deleting removes access", async () => {
    assert.equal((await call("teacher", "PUT", "/me/photo", png, "image/png")).data.status, "approved");
    const t = (await call("teacher", "GET", "/me/profile")).data.photo.url.replace("/api", "");
    const served = await fetch(base + t, { headers: { "x-test-user": "kid" } });
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("x-content-type-options"), "nosniff");
    assert.match(served.headers.get("content-security-policy") ?? "", /sandbox/);
    assert.equal((await call("teacher", "DELETE", "/me/photo")).status, 200);
    assert.equal((await call("kid", "GET", t)).status, 404);
  });
} finally { server.close(); await engine.close(); }
console.log(`# profile integration: ${passed} passed, ${failures} failed`);
if (failures) process.exitCode = 1;
