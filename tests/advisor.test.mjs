import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, evaluate, DECISION_MODEL } from '../plugins/model-advisor/src/advisor.mjs';
import { grade } from '../evals/grade.mjs';

function sample() {
  const now=Date.now();
  const configs=[{model:'test-a',effort:'low',speed:null},{model:'test-b',effort:'high',speed:null}];
  return {
    request:{task:'Fix a parser defect.',taskCategory:'bug',priority:'quality',configurations:configs},
    inventory:{observedAt:new Date(now).toISOString(),cliVersion:'test-1',accessType:'chatgpt',models:configs.map(c=>({id:c.model,efforts:[c.effort],speedModes:null}))},
    evidence:{version:'synthetic-test-only',records:configs.map((c,i)=>({configuration:c,taskCategory:'bug',harnessVersion:'test-1',accessType:'chatgpt',source:'synthetic unit-test data, not performance evidence',kind:'measured',attempts:3,passed:3,estimatedCostUsd:i?0.1:0.5,latencyMs:i?500:100,observedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString()}))},
  };
}
const response=(a=3,b=2)=>({model:DECISION_MODEL,answers:{c0_fit:score(a),c1_fit:score(b)},usage:{input_tokens:20,output_tokens:0}});
function score(n){return {type:'score',score:n,confidence:1,probabilities:Object.fromEntries([0,1,2,3].map(i=>[i,i===n?1:0]))};}

test('unknown speed modes are excluded, not invented',()=>{
  const s=sample(); s.request.configurations[0].speed='fast';
  const out=prepare(s.request,s.inventory,s.evidence);
  assert.equal(out.candidates.length,1);assert.match(out.excluded[0].reason,/unverified/);
});
test('missing or stale evidence prevents a provider call',async()=>{
  const s=sample();s.evidence.records=[];
  const prepared=prepare(s.request,s.inventory,s.evidence);
  const result=await evaluate(prepared,{fetchImpl:()=>{throw Error('must not call');}});
  assert.equal(result.status,'needs_evidence');
});
test('evidence for a different effort or harness is not reused',()=>{
  const s=sample();s.evidence.records[0].harnessVersion='other';s.evidence.records[1].configuration={...s.evidence.records[1].configuration,effort:'low'};
  assert.equal(prepare(s.request,s.inventory,s.evidence).status,'needs_evidence');
});
test('unknown billing cannot satisfy a monetary ceiling',()=>{
  const s=sample();s.request.constraints={maxEstimatedCostUsd:0.25};s.evidence.records[1].estimatedCostUsd=null;
  assert.equal(prepare(s.request,s.inventory,s.evidence).status,'no_eligible_option');
});
test('stale inventory and unsupported hard constraints are rejected',()=>{
  const s=sample();s.inventory.observedAt='2020-01-01T00:00:00Z';assert.throws(()=>prepare(s.request,s.inventory,s.evidence),/stale/);
  s.inventory.observedAt=new Date().toISOString();s.request.constraints={localOnly:true};assert.throws(()=>prepare(s.request,s.inventory,s.evidence),/Unsupported hard constraint/);
});
test('preference changes use measured metrics and preserve quality floor',()=>{
  const s=sample();
  const quality=finish(prepare(s.request,s.inventory,s.evidence),response());assert.equal(quality.primary.model,'test-a');
  s.request.priority='cost';const cost=finish(prepare(s.request,s.inventory,s.evidence),response());assert.equal(cost.primary.model,'test-b');
  assert.equal(finish(prepare(s.request,s.inventory,s.evidence),response(3,1)).primary.model,'test-a');
  s.request.priority='speed';assert.equal(finish(prepare(s.request,s.inventory,s.evidence),response()).primary.model,'test-a');
});
test('invalid and inconsistent provider scores fail closed',()=>{
  const s=sample(),p=prepare(s.request,s.inventory,s.evidence),r=response();
  r.answers.c0_fit.score=2;assert.throws(()=>finish(p,r),/disagrees/);
  r.answers.c0_fit.score=3;r.model='other-version';assert.throws(()=>finish(p,r),/Unexpected decision model/);
});
test('unknown costs do not become zero-cost alternatives',()=>{
  const s=sample();s.request.priority='cost';delete s.evidence.records[0].estimatedCostUsd;
  assert.equal(prepare(s.request,s.inventory,s.evidence).status,'needs_evidence');
});
test('live adapter sends pinned model, returns provisional evidence and never echoes keys',async()=>{
  const s=sample();let calls=0;
  const result=await evaluate(prepare(s.request,s.inventory,s.evidence),{apiKey:'unit-test-secret',fetchImpl:async(url,opts)=>{
    calls++;assert.equal(url,'https://api.liquid.ai/decisions/v1/systemone');assert.equal(JSON.parse(opts.body).model,'d1:free');assert.equal(opts.redirect,'error');assert.equal(opts.headers.Authorization,'Bearer unit-test-secret');
    return {ok:true,json:async()=>response()};
  }});
  assert.equal(calls,1);assert.equal(result.status,'provisional');assert.ok(!JSON.stringify(result).includes('unit-test-secret'));
});
test('timeout is not retried and raw provider errors are not surfaced',async()=>{
  const s=sample();let calls=0;
  await assert.rejects(evaluate(prepare(s.request,s.inventory,s.evidence),{apiKey:'secret',fetchImpl:async()=>{calls++;throw Error('secret');}}),/no retry/);
  assert.equal(calls,1);
});
test('input limit stops the request before any provider call',async()=>{
  const s=sample();await assert.rejects(evaluate(prepare(s.request,s.inventory,s.evidence),{apiKey:'secret',maxInputBytes:1,fetchImpl:()=>{throw Error('must not call');}}),/input limit/);
});

test('paid model payloads cannot reach the provider',async()=>{
  const s=sample(),p=prepare(s.request,s.inventory,s.evidence);p.payload.model='d1';
  let calls=0;
  await assert.rejects(evaluate(p,{apiKey:'secret',fetchImpl:()=>{calls++;}}),/paid fallback is disabled/);
  assert.equal(calls,0);
});

test('rate limits and malformed responses do not leak raw output or retry',async()=>{
  const s=sample(),p=prepare(s.request,s.inventory,s.evidence);let calls=0;
  await assert.rejects(evaluate(p,{apiKey:'secret',fetchImpl:async()=>{calls++;return {ok:false,status:429,json:()=>{throw Error('secret');}};}}),/HTTP 429; no retry or paid fallback/);
  assert.equal(calls,1);
  await assert.rejects(evaluate(p,{apiKey:'secret',fetchImpl:async()=>({ok:true,json:async()=>{throw Error('secret');}})}),/invalid JSON; no retry/);
});

test('an insufficient-evidence response retains provider usage for the receipt',()=>{
  const s=sample(),r=response(1,1),result=finish(prepare(s.request,s.inventory,s.evidence),r);
  assert.equal(result.status,'needs_evidence');assert.equal(result.decisionModel,'d1:free');assert.deepEqual(result.usage,r.usage);
});
test('grader detects the real fixture defects and accepts the independent control',async()=>{
  const broken=await grade('evals/fixtures/merge-intervals/intervals.mjs');
  const control=await grade('evals/control/intervals.mjs');
  assert.equal(broken.passed,2);assert.equal(broken.total,7);
  assert.equal(control.passed,7);assert.equal(control.total,7);
  assert.notEqual(broken.sourceSha256,control.sourceSha256);
});
