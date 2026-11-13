import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkMaterial, excerptSupportedByPassages, retrieveMaterialPassages } from '../lib/materialRetrieval.ts';

test('retrieval ranks relevant passages and caps the model context',()=>{
 const text=[
  `Photosynthesis uses light energy to convert water and carbon dioxide into glucose and oxygen. ${'Plants contain chlorophyll in chloroplasts. '.repeat(14)}`,
  `The water cycle describes evaporation, condensation and precipitation. ${'Water vapour cools into droplets in clouds. '.repeat(14)}`,
  `Cellular respiration releases energy from glucose using oxygen. ${'Cells produce carbon dioxide and water. '.repeat(14)}`,
 ].join('\n\n');
 const passages=retrieveMaterialPassages(text,'How does photosynthesis use light energy?',{maxContextChars:1800});
 assert.ok(passages.length>0);
 assert.ok(passages[0].text.toLowerCase().includes('photosynthesis'));
 assert.ok(passages.reduce((sum,p)=>sum+p.text.length,0)<=1800);
 assert.ok(passages.length<=4);
});

test('passages overlap for context but source quotes must be verifiable',()=>{
 const text='The first sentence explains force and motion. The second sentence describes acceleration caused by force. The third sentence explains mass.';
 const chunks=chunkMaterial(text,200,40);
 assert.ok(chunks.length>=1);
 assert.ok(excerptSupportedByPassages(chunks,'acceleration caused by force'));
 assert.equal(excerptSupportedByPassages(chunks,'an unsupported claim from outside the source'),false);
});
