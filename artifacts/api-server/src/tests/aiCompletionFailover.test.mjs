import test from "node:test";
import assert from "node:assert/strict";

test("a real Groq SDK 429 fails over to mocked Hugging Face without extra calls", async () => {
  const originalFetch = globalThis.fetch;
  const saved = Object.fromEntries(["GROQ_API_KEY","HF_TOKEN","HUGGINGFACE_API_KEY","OPENAI_API_KEY"].map(k => [k,process.env[k]]));
  let groqCalls = 0, hfCalls = 0, groqModelCalls = 0;
  process.env.GROQ_API_KEY = "synthetic-groq-test-key";
  process.env.HF_TOKEN = "synthetic-hf-test-key";
  delete process.env.HUGGINGFACE_API_KEY;
  delete process.env.OPENAI_API_KEY;

  globalThis.fetch = async input => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const json = (body, status=200, headers={}) => new Response(JSON.stringify(body), {
      status, headers: {"content-type":"application/json", ...headers},
    });
    if (url.includes("api.groq.com") && url.endsWith("/models")) {
      groqModelCalls++;
      return json({object:"list",data:[{id:"llama-3.1-8b-instant",object:"model",created:1,owned_by:"groq"}]});
    }
    if (url.includes("api.groq.com") && url.includes("/chat/completions")) {
      groqCalls++;
      return json({error:{message:"Synthetic quota",type:"rate_limit_error"}},429,{"retry-after":"60"});
    }
    if (url.includes("router.huggingface.co") && url.includes("/chat/completions")) {
      hfCalls++;
      return json({id:"test-completion",object:"chat.completion",created:1,model:"synthetic",
        choices:[{index:0,finish_reason:"stop",message:{role:"assistant",content:'{"status":"READY"}'}}]});
    }
    throw new Error("Unexpected outbound request in mock test: " + url);
  };
  try {
    const { completeAIJson } = await import("../lib/aiCompletion.ts");
    const generate = () => completeAIJson({
      task:"grading", system:"Return synthetic status.", payload:{synthetic:true},
      maxCompletionTokens:128,
      validate(v) { if (!v || v.status!=="READY") throw new Error("Invalid"); return v; },
    });
    const first=await generate();
    assert.equal(first.provider,"huggingface");
    assert.equal(first.value.status,"READY");
    assert.equal(groqCalls,1);
    assert.equal(hfCalls,1);
    // The circuit breaker should skip the provider on cooldown on subsequent work.
    const second=await generate();
    assert.equal(second.provider,"huggingface");
    assert.equal(groqCalls,1);
    assert.equal(hfCalls,2);
    assert.ok(groqModelCalls>=1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key,val] of Object.entries(saved)) {
      if (val===undefined) delete process.env[key];
      else process.env[key]=val;
    }
  }
});
