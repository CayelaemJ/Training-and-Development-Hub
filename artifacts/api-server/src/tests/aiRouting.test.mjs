import test from "node:test";
import assert from "node:assert/strict";
import { aiRoutingWeights, createAiProviderOrderer } from "../lib/aiRouting.ts";

test("task-specific routing shares traffic without requiring both providers", () => {
  const choose = createAiProviderOrderer({groq:1,huggingface:1});
  const available = ["groq","huggingface"];
  const exams = Array.from({length:8},()=>choose(available,"exam_generation")[0]);
  const grading = Array.from({length:8},()=>choose(available,"grading")[0]);
  const plans = Array.from({length:8},()=>choose(available,"development_plan")[0]);
  assert.equal(exams.filter(x=>x==="huggingface").length,6);
  assert.equal(grading.filter(x=>x==="groq").length,6);
  assert.equal(plans.filter(x=>x==="huggingface").length,6);
});

test("initial requests choose the task-preferred provider",()=>{
 const select=createAiProviderOrderer({groq:1,huggingface:1});
 assert.equal(select(["groq","huggingface"],"exam_generation")[0],"huggingface");
 assert.equal(select(["groq","huggingface"],"development_plan")[0],"huggingface");
 assert.equal(select(["groq","huggingface"],"grading")[0],"groq");
});

test("fallback order is deterministic and legacy OpenAI is last",()=>{
  const choose=createAiProviderOrderer({groq:1,huggingface:1});
  assert.deepEqual(choose(["groq","huggingface","openai"],"grading"),["groq","huggingface","openai"]);
  assert.deepEqual(choose(["huggingface"],"grading"),["huggingface"]);
  assert.deepEqual(choose(["openai"],"exam_generation"),["openai"]);
  assert.deepEqual(choose([]),[]);
});

test("traffic preferences cannot disable emergency fallback",()=>{
  const choose=createAiProviderOrderer({groq:0,huggingface:5});
  assert.deepEqual(choose(["groq","huggingface"],"grading"),["huggingface","groq"]);
});

test("routing weights accept only safe bounded integers",()=>{
  assert.deepEqual(aiRoutingWeights({CABO_AI_GROQ_WEIGHT:"3",CABO_AI_HF_WEIGHT:"1"}),{groq:3,huggingface:1});
  assert.deepEqual(aiRoutingWeights({CABO_AI_GROQ_WEIGHT:"0",CABO_AI_HF_WEIGHT:"0"}),{groq:1,huggingface:1});
  assert.deepEqual(aiRoutingWeights({CABO_AI_GROQ_WEIGHT:"999999",CABO_AI_HF_WEIGHT:"abc"}),{groq:1,huggingface:1});
});
