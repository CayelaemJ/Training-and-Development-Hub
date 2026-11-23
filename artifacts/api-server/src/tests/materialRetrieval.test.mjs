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

test('stemming matches word forms and spellings', async () => {
  const { stem } = await import('../lib/materialRetrieval.ts');
  assert.equal(stem('factorising'), stem('factorise'));
  assert.equal(stem('factorised'), stem('factorizing'));
  assert.equal(stem('equations'), stem('equation'));
  assert.equal(stem('studies'), stem('study'));
  assert.equal(stem('cat'), 'cat');
 const text = `Section one. ${'Revision notes about quadratics. '.repeat(30)} To factorise a trinomial, find two numbers whose product and sum match. ${'More unrelated filler words here. '.repeat(30)}`;
 const hits = retrieveMaterialPassages(text, 'How do I factorize trinomials?');
 assert.ok(hits.some(p => p.text.includes('factorise a trinomial')));
});

test('summary questions get passages spread through the material', () => {
 const text = Array.from({ length: 12 }, (_, i) => `Chapter ${i + 1} covers topic number ${i + 1}. ${'Detail sentence for this chapter. '.repeat(25)}`).join('\n\n');
 const spread = retrieveMaterialPassages(text, 'Summarise this material for me');
 assert.equal(spread.length, 4);
 assert.ok(spread[0].text.includes('Chapter 1 '));
 assert.ok(!spread.every(p => p.text.includes('Chapter 1 ')), 'not all from the start');
 assert.deepEqual(retrieveMaterialPassages(text, 'the and of'), [], 'stop words alone still find nothing');
});

test('passages come back in reading order and never end mid-word', () => {
 const text = `Alpha topic: mitochondria produce energy. ${'filler words appear here. '.repeat(40)} Beta topic: mitochondria have their own DNA. ${'other filler words. '.repeat(40)}`;
 const hits = retrieveMaterialPassages(text, 'mitochondria energy DNA', { maxContextChars: 1000 });
 const first = text.indexOf(hits[0].text.slice(0, 30)), second = hits[1] ? text.indexOf(hits[1].text.slice(0, 30)) : Infinity;
 assert.ok(first < second);
 for (const p of hits) assert.ok(text.includes(p.text), 'passage is an exact slice of the source');
});

test('citations tolerate curly quotes, dashes, case, trailing punctuation and ellipses but not invention', () => {
 const passages = ['The learner’s answer — shown in red — must be checked against the memo before marks are published to parents.'];
 assert.ok(excerptSupportedByPassages(passages, "the learner's answer - shown in red - must be checked."));
 assert.ok(excerptSupportedByPassages(passages, 'The learner’s answer — shown in red ... before marks are published to parents'));
 assert.equal(excerptSupportedByPassages(passages, 'before marks are published ... the learner’s answer'), false, 'parts must be in order');
 assert.equal(excerptSupportedByPassages(passages, 'marks are always published immediately to parents'), false);
 assert.equal(excerptSupportedByPassages(passages, 'The learner ... parents'), false, 'tiny fragments are not evidence');
});
