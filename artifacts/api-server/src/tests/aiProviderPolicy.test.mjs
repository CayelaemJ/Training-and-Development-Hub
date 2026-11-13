import test from 'node:test';
import assert from 'node:assert/strict';
import { aiProviderConfiguration, groqApiKey } from '../lib/aiProviderPolicy.ts';

test('AI provider policy selects Groq only, regardless of OpenAI credentials',()=>{
 const openAiOnly=aiProviderConfiguration({OPENAI_API_KEY:'test-key-not-used'});
 assert.deepEqual(openAiOnly,{configured:false,preferredProvider:'none',developmentModel:'openai/gpt-oss-120b'});
 assert.equal(groqApiKey({OPENAI_API_KEY:'test-key-not-used'}),null);
 const groq=aiProviderConfiguration({GROQ_API_KEY:' test-groq-key ',OPENAI_API_KEY:'ignored'});
 assert.deepEqual(groq,{configured:true,preferredProvider:'groq',developmentModel:'openai/gpt-oss-120b'});
 assert.equal(groqApiKey({GROQ_API_KEY:' test-groq-key '}),'test-groq-key');
});

test('the preferred Groq model can be overridden without requiring OpenAI configuration',()=>{
 assert.equal(aiProviderConfiguration({GROQ_API_KEY:'test',GROQ_EXAM_MODEL:'groq/active-model'}).developmentModel,'groq/active-model');
});
