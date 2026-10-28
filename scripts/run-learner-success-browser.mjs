// Serve the built SPA and execute fixture-driven UI checks in one process namespace.
import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const root = path.resolve(
  import.meta.dirname,
  "../artifacts/training-platform/dist/public",
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    let body;
    let target = file;
    try {
      body = await readFile(target);
    } catch {
      target = path.join(root, "index.html");
      body = await readFile(target);
    }
    res
      .writeHead(200, {
        "Content-Type":
          types[path.extname(target)] ?? "application/octet-stream",
      })
      .end(body);
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const child = spawn(
    process.execPath,
    [path.join(import.meta.dirname, process.argv.includes("--admissions") ? "verify-demo-admissions-browser.mjs" : process.argv.includes("--pwa") ? "verify-installable-app.mjs" : "verify-learner-success-browser.mjs")],
    {
      env: {
        ...process.env,
        CABO_UI_TEST_URL: `http://127.0.0.1:${server.address().port}`,
      },
      stdio: "inherit",
    },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", reject);
  });
} finally {
  server.close();
}
