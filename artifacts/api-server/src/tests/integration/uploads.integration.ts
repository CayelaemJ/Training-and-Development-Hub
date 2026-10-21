import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import storage from "../../routes/storage";
import training from "../../routes/training";
import written from "../../routes/writtenExams";
import { extractMaterialText } from "../../lib/materialText";
import { sourceWindow, questionBatches } from "../../lib/generationBatches";
import { engine } from "./supportTestDb";
import { createCanvas } from "@napi-rs/canvas";
import { fixtureFiles, pdfFixture } from "./uploadFixtures";
process.env.CABO_ENVIRONMENT = "testing";
process.env.ENABLE_MATERIAL_READING = "true";
await engine.exec(`CREATE TABLE upload_intents(object_path text PRIMARY KEY,user_id varchar,file_name varchar,content_type varchar,size_bytes integer,created_at timestamptz DEFAULT now());
CREATE TABLE study_materials(id serial PRIMARY KEY,user_id varchar,title varchar,file_name varchar,content_type varchar,size_bytes integer,object_path text UNIQUE,character_count integer,created_at timestamptz DEFAULT now());
CREATE TABLE material_upload_blobs(object_path text PRIMARY KEY,user_id varchar,bytes bytea,created_at timestamptz DEFAULT now());
CREATE TABLE training_quizzes(id serial PRIMARY KEY,user_id varchar,material_id integer,title varchar,difficulty varchar,question_count integer,option_count integer,model_id varchar,prompt_version varchar,questions jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE written_exams(id serial PRIMARY KEY,user_id varchar,material_id integer,title varchar,difficulty varchar,questions jsonb,model_id varchar,created_at timestamptz DEFAULT now());`);
const migration = await readFile(
  "lib/db/migrations/20261021_material_reading.sql",
  "utf8",
);
await engine.exec(migration);
await engine.exec(migration);
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = req.headers["x-test-user"]
    ? ({ id: String(req.headers["x-test-user"]) } as any)
    : undefined;
  req.isAuthenticated = (() => !!req.user) as any;
  req.log = { info() {}, warn() {}, error() {} } as any;
  next();
});
app.use("/api", storage, training, written);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
async function call(
  user: string,
  path: string,
  body?: unknown,
  method = "POST",
): Promise<{status:number;data:any}> {
  const res = await fetch(base + path, {
    method,
    headers: { "x-test-user": user, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
try {
  assert.equal(
    (
      await call("", "/storage/uploads/request-url", {
        name: "notes.txt",
        size: 100,
        contentType: "text/plain",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("a", "/storage/uploads/request-url", {
        name: "bad.exe",
        size: 100,
        contentType: "application/octet-stream",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("a", "/storage/uploads/request-url", {
        name: "large.txt",
        size: 31 * 1024 * 1024,
        contentType: "text/plain",
      })
    ).status,
    400,
  );
  const accepted = await call("a", "/storage/uploads/request-url", {
    name: "large.txt",
    size: 25 * 1024 * 1024,
    contentType: "text/plain",
  });
  assert.equal(accepted.status, 200);
  for (const file of fixtureFiles()) {
    const extraction = await extractMaterialText(file.name, file.bytes);
    assert.match(extraction, /Fractions|fractions/);
    const intent = await call("a", "/storage/uploads/request-url", {
      name: file.name,
      size: file.bytes.length,
      contentType: "application/octet-stream",
    });
    assert.equal(intent.status, 200);
    const path = new URL(intent.data.uploadURL).pathname;
    let put = await fetch(base.replace("/api", "") + path, {
      method: "PUT",
      headers: {
        "x-test-user": "b",
        "Content-Type": "application/octet-stream",
      },
      body: file.bytes,
    });
    assert.equal(put.status, 404);
    put = await fetch(base.replace("/api", "") + path, {
      method: "PUT",
      headers: {
        "x-test-user": "a",
        "Content-Type": "application/octet-stream",
      },
      body: file.bytes,
    });
    assert.equal(put.status, 204, file.name);
    const material = await call("a", "/materials", {
      title: file.name,
      objectPath: intent.data.objectPath,
    });
    assert.equal(material.status, 201, JSON.stringify(material.data));
    const cached = await engine.query<{ extracted_text: string }>(
      `SELECT extracted_text FROM study_materials WHERE id=${material.data.id}`,
    );
    assert.match(cached.rows[0].extracted_text, /Fractions|fractions/);
    const forbidden = await call(
      "b",
      `/materials/${material.data.id}/quizzes`,
      { questionCount: 7, optionCount: 4, difficulty: "beginner" },
    );
    assert.equal(forbidden.status, 404);
    const quiz = await call("a", `/materials/${material.data.id}/quizzes`, {
      questionCount: 7,
      optionCount: 4,
      difficulty: "beginner",
    });
    assert.equal(quiz.status, 201, JSON.stringify(quiz.data));
    assert.equal(quiz.data.questions.length, 7);
    assert.equal(quiz.data.questions[0].correctOption, undefined);
    const exam = await call(
      "a",
      `/materials/${material.data.id}/written-exams`,
      { questionCount: 7, difficulty: "beginner" },
    );
    assert.equal(exam.status, 201, JSON.stringify(exam.data));
    assert.equal(exam.data.questions.length, 7);
  }
  const image = createCanvas(600, 400);
  const context = image.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, 600, 400);
  context.fillStyle = "black";
  context.font = "20px sans-serif";
  context.fillText("Equivalent fractions have the same value.", 15, 45);
  for (const [name, mime] of [
    ["notes.png", "image/png"],
    ["notes.jpg", "image/jpeg"],
    ["notes.webp", "image/webp"],
  ] as const) {
    const bytes = mime === "image/png" ? image.toBuffer(mime) : image.toBuffer(mime);
    await assert.rejects(extractMaterialText(name, bytes), /Tick/);
  }
  const oversized = Buffer.from(image.toBuffer("image/png"));
  oversized.writeUInt32BE(50000, 16);
  oversized.writeUInt32BE(50000, 20);
  await assert.rejects(
    extractMaterialText("large.png", oversized, { allowAiReading: true }),
    /too large/,
  );
  const bomb = Buffer.from(
    fixtureFiles().find((f) => f.name.endsWith(".pptx"))!.bytes,
  );
  const central = bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bomb.writeUInt32LE(33 * 1024 * 1024, central + 24);
  await assert.rejects(extractMaterialText("large.pptx", bomb), /expands/);
  await assert.rejects(
    extractMaterialText("broken.pdf", Buffer.from("not a PDF")),
    /PDF/,
  );
  await assert.rejects(
    extractMaterialText("scan.pdf", pdfFixture(true)),
    /scanned/,
  );
  await assert.rejects(
    extractMaterialText("empty.txt", Buffer.from("short")),
    /little readable/,
  );
  const long = "START" + ".".repeat(100000) + "END";
  const window = sourceWindow(long);
  assert.ok(window.includes("START") && window.includes("END"));
  const batches: number[] = [];
  const result = await questionBatches(long, 30, async (_text, count) => {
    batches.push(count);
    return Array(count).fill("q");
  });
  assert.equal(result.length, 30);
  assert.ok(batches.every((n) => n <= 5));
  // Reproduce the pre-cache Railway schema and prove the default-off path still works.
  process.env.ENABLE_MATERIAL_READING='false';
  await engine.exec('ALTER TABLE study_materials DROP COLUMN extracted_text; ALTER TABLE study_materials DROP COLUMN allow_ai_reading; ALTER TABLE upload_intents DROP COLUMN allow_ai_reading;');
  const legacy=await call('a','/materials/1/quizzes',{questionCount:3,optionCount:4,difficulty:'beginner'});assert.equal(legacy.status,201,JSON.stringify(legacy.data));
  console.log(
    "PASS: seven file formats through upload, extraction, cached source, quiz and written-test persistence; owner isolation; 25MB acceptance; corrupt/empty/scanned PDF errors; migration replay; document-wide batching. AI responses are synthetic fixtures.",
  );
} finally {
  server.close();
  await engine.close();
}
