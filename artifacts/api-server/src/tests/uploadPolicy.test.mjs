import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMaterial,MAX_FILE_BYTES,materialTypes} from '../lib/uploadPolicy.ts';
import {sourceWindow,questionBatches} from '../lib/generationBatches.ts';
import {ApiError} from '../../../../lib/api-client-react/src/custom-fetch.ts';
test('upload formats and the advertised 30MB boundary agree',()=>{
 for(const ext of Object.keys(materialTypes))assert.doesNotThrow(()=>validateMaterial('notes.'+ext,MAX_FILE_BYTES));
 assert.throws(()=>validateMaterial('notes.exe',10),/Choose a/);
 assert.throws(()=>validateMaterial('notes.pdf',0),/empty/);
 assert.throws(()=>validateMaterial('notes.pdf',MAX_FILE_BYTES+1),/30 MB/);
});
test('a long source window includes both ends, and batch failures cannot publish partial work',async()=>{
 const text='OPENING'+'.'.repeat(100000)+'ENDING';const selected=sourceWindow(text);assert.ok(selected.includes('OPENING'));assert.ok(selected.includes('ENDING'));
 await assert.rejects(questionBatches(text,10,async(_text,_count,i)=>{if(i===1)throw Error('provider unavailable');return ['partial'];}),/unavailable/);
});
test('user-facing errors do not expose HTTP prefixes or upstream HTML',()=>{
 const err=new ApiError(new Response('',{status:503}),{error:'Your material is saved. Try again shortly.'},{method:'POST',url:'/api/materials'});assert.equal(err.message,'Your material is saved. Try again shortly.');
 const html=new ApiError(new Response('',{status:502}),'<html>upstream stack trace</html>',{method:'POST',url:'/api/materials'});assert.doesNotMatch(html.message,/HTTP|html|stack trace/);
});
