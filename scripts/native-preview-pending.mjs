#!/usr/bin/env node
// Explicitly UNCONFIGURED preview: no database, sessions or training API.
// This prevents Render crash loops without pretending the pilot is usable.
import http from "node:http";
const port = Number(process.env.PORT || 10000);
if (!Number.isSafeInteger(port) || port <= 0 || port > 65535)
  throw Error("Invalid listening port.");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport"
content="width=device-width, initial-scale=1"><title>CABO Learning Hub | Test setup pending</title>
<style>body{background:#101c23;color:#eff3f1;font:16px system-ui,sans-serif;margin:0;display:grid;min-height:100vh;place-items:center}
main{padding:28px;max-width:580px}strong{color:#de8c59;font-size:32px;letter-spacing:.05em}
h1{font-size:clamp(24px,5vw,40px);line-height:1.15}p{color:#bacac9;line-height:1.6}
small{color:#88aba8}</style></head><body><main>
<strong>CABO</strong><h1>Native Learning Hub test environment</h1>
<p>The isolated demonstration database has not been connected yet. Test sign-in
and learner records are intentionally disabled. This preview is not a production service.</p>
<small>Protected test setup pending | No school records loaded</small>
</main></body></html>`;
http.createServer((req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("X-Frame-Options","DENY");
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});
    res.end(html);
  } else {
    res.writeHead(503,{"Content-Type":"application/json; charset=utf-8"});
    res.end(JSON.stringify({status:"test_setup_pending",ready:false}));
  }
}).listen(port,"0.0.0.0",()=>console.log("CABO isolated native preview: setup pending; application APIs disabled"));
