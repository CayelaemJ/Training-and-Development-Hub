import test from "node:test";
import assert from "node:assert/strict";
import {normalizeExternalEvidenceUrl,MASTERY_EXPLANATIONS} from "../lib/passportPolicy.ts";
test("public HTTPS profiles accepted",()=>{
 assert.equal(normalizeExternalEvidenceUrl("https://github.com/example/project"),"https://github.com/example/project");
 assert.equal(normalizeExternalEvidenceUrl("https://www.linkedin.com/in/example"),"https://www.linkedin.com/in/example");
 assert.equal(normalizeExternalEvidenceUrl("https://example.co.za/portfolio"),"https://example.co.za/portfolio");
});
test("local, private, embedded credentials, insecure protocols rejected",()=>{
 for(const u of ["http://example.com","javascript:alert(1)","file:///etc/passwd","https://localhost/","https://127.0.0.1/test","https://10.0.0.1/","https://[::1]/","https://server.local/","https://system.internal/","https://user:pass@example.com/","https://example.com:8080/path","https://example.com\n.evil.test/"]){
  assert.equal(normalizeExternalEvidenceUrl(u),null,u);
 }
});
test("mastery is evidence-specific, not an intelligence rating",()=>{
 assert.equal(MASTERY_EXPLANATIONS.length,5);
 assert.match(MASTERY_EXPLANATIONS[0],/not a judgement of ability/i);
 assert.match(MASTERY_EXPLANATIONS[4],/unfamiliar situations/i);
});
