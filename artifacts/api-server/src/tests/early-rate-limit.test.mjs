import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../app.ts",import.meta.url),"utf8");
const pos=snippet=>{
 const at=app.indexOf(snippet);
 assert.ok(at>=0,`Missing app middleware: ${snippet}`);
 return at;
};

test("rate limiter runs before untrusted request bodies and auth session lookups",()=>{
 const limiter=pos('app.use("/api", apiRateLimit);');
 for(const middleware of ["app.use(cookieParser());","app.use(express.json());",
  "app.use(express.urlencoded({ extended: true }));","app.use(authMiddleware);",
  'app.use("/api", router);']){
  assert.ok(limiter<pos(middleware),`API limiter must precede ${middleware}`);
 }
});

test("health endpoint is explicitly exempt but API routes are not",()=>{
 const source=readFileSync(new URL("../middlewares/rateLimit.ts",import.meta.url),"utf8");
 assert.match(source,/path === "\/api\/health"/);
 assert.match(source,/\["all", 240, 60_000\]/);
});

test("provider smoke tests and development plan drafts receive explicit abuse limits",()=>{
 const source=readFileSync(new URL("../middlewares/rateLimit.ts",import.meta.url),"utf8");
 assert.match(source,/development-plan/);
 assert.match(source,/path === "\/api\/platform\/mlops\/smoke-test"/);
 assert.match(source,/\["ai-smoke-test", 5, 10 \* 60_000\]/);
});
