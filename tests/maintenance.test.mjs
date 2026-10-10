import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSources} from '../maintenance/check-sources.mjs';
const sources=[{id:'models',url:'https://learn.chatgpt.com/docs/models.md',affects:['models']}];
const mock=text=>async()=>({ok:true,body:[Buffer.from(text)]});
test('source change is deduplicated by reviewed content hash without mutating knowledge',async()=>{
  const first=await checkSources(sources,null,{fetchImpl:mock('model guidance '.repeat(20))});assert.equal(first.needsReview,true);
  const repeat=await checkSources(sources,first,{fetchImpl:mock('model guidance '.repeat(20))});assert.equal(repeat.needsReview,false);
  const changed=await checkSources(sources,first,{fetchImpl:mock('new model guidance '.repeat(20))});assert.equal(changed.needsReview,true);
  assert.equal(first.entries[0].status,'review_required');
});
test('failure is retained and no arbitrary source or private endpoint is fetched',async()=>{
  let calls=0;const failure=await checkSources(sources,null,{fetchImpl:async()=>{calls++;throw Error('timeout');}});assert.equal(failure.failed,true);assert.equal(calls,1);
  await assert.rejects(checkSources([{url:'http://127.0.0.1/private'}],null,{fetchImpl:()=>{throw Error('not reached');}}),/allowlisted/);
});
