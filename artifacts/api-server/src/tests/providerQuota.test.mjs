import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderScheduler,ProviderQuotaError,quotaDelay} from '../lib/providerQuota.ts';
import {questionBatches} from '../lib/generationBatches.ts';
const limited = seconds => ({status:429,headers:new Headers({'retry-after':String(seconds)})});
test('quota retry waits for the provider before repeating the request',async()=>{
 let clock=0,calls=0;const waits=[];
 const schedule=createProviderScheduler(()=>clock,async ms=>{waits.push(ms);clock+=ms;});
 assert.equal(await schedule(async()=>{if(++calls===1)throw limited(2);return 'ok';},10000),'ok');
 assert.deepEqual(waits,[2000]);assert.equal(calls,2);
});
test('long quota cooldown is shared without further provider calls',async()=>{
 let calls=0;const schedule=createProviderScheduler(()=>0,async()=>{});
 await assert.rejects(schedule(async()=>{calls++;throw limited(3600);},180000),e=>e instanceof ProviderQuotaError&&e.retryAfterSeconds===3600);
 await assert.rejects(schedule(async()=>{calls++;},180000),ProviderQuotaError);
 assert.equal(calls,1);
});
test('requests serialize and a non-quota failure releases the queue',async()=>{
 const schedule=createProviderScheduler();let active=0,peak=0;
 const op=()=>schedule(async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;},Date.now()+10000);
 await Promise.all([op(),op(),op()]);assert.equal(peak,1);
 await assert.rejects(schedule(async()=>{throw new Error('test failure');},Date.now()+10000));await op();
 assert.equal(quotaDelay({status:401}),null);assert.equal(quotaDelay({status:429}),60000);
});
test('31 questions cover a large document in small sequential batches',async()=>{
 const source='START'+'.'.repeat(54640)+'END';const sections=[];let active=0,peak=0;
 const result=await questionBatches(source,31,async(text,count)=>{active++;peak=Math.max(peak,active);sections.push(text);await Promise.resolve();active--;return Array(count).fill('q');});
 assert.equal(result.length,31);assert.equal(peak,1);assert.ok(sections.every(s=>s.length<6400));assert.ok(sections[0].startsWith('START'));assert.ok(sections.at(-1).endsWith('END'));
});
