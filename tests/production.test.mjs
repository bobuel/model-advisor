import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {prepareRecommendation,finishRecommendation,validateKnowledge} from '../service/recommend.mjs';
import {Quota} from '../service/quota.mjs';
import {createAdvisor,createHttpServer} from '../service/app.mjs';
import {recommend} from '../plugins/model-advisor/src/hosted-client.mjs';
import {journeys} from '../evals/production/cases.mjs';
const knowledge=JSON.parse(await readFile(new URL('../knowledge/current.json',import.meta.url),'utf8'));
const now=Date.parse(knowledge.reviewedAt)+1000;
const request=()=>({task:'Implement a pure merge patch with literal keys.',taskCategory:'objects',priority:'balanced',executionMode:'code-only',harness:{id:'codex',version:'codex-cli 0.162.0-alpha.2',accessType:'chatgpt',observedAt:new Date(now).toISOString(),models:knowledge.models.map(m=>({id:m.id,efforts:m.efforts,speedModes:null}))}});
function answer(payload,choice='c0'){
  return {model:'d1:free',answers:{configuration:{type:'choice',choice,confidence:1,probabilities:Object.fromEntries(Object.keys(payload.questions.configuration.criteria).map(k=>[k,k===choice?1:0]))}},usage:{input_tokens:100,output_tokens:0}};
}
async function fixture(t,{fetchImpl,onPrepared,limit=100,excludeTaskIds=[]}={}){
  const dir=await mkdtemp(join(tmpdir(),'advisor-test-')),quota=new Quota(join(dir,'quota.sqlite'),{dailyLimit:limit,now:()=>now});
  const advisor=createAdvisor({knowledge,quota,apiKey:'synthetic-test-secret',now:()=>now,excludeTaskIds,onPrepared,fetchImpl:fetchImpl??(async(u,o)=>({ok:true,json:async()=>answer(JSON.parse(o.body))}))});
  const server=createHttpServer({advisor,knowledge});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));quota.close();await rm(dir,{recursive:true,force:true});});
  return {endpoint:`http://127.0.0.1:${server.address().port}`,quota,dir};
}
test('all 40 supported combinations reach the same production preparation path',()=>{
  const p=prepareRecommendation(request(),knowledge,{now});assert.equal(p.candidates.length,40);
  assert.ok(Buffer.byteLength(JSON.stringify(p.payload))<=16000);
  for(const c of p.candidates){const r=finishRecommendation(p,answer(p.payload,c.id));
    const supported=p.findings.some(f=>f.topic==='model-fit'&&f.models.includes(c.model))||p.observations.some(o=>o.model===c.model&&o.effort===c.effort);
    if(!supported){assert.equal(r.status,'needs_evidence');continue;}
    assert.equal(r.primary.model,c.model);assert.equal(r.primary.effort,c.effort);assert.equal(r.primary.speed,null);}
});
test('same-category prior examples remain, target results alone are hidden',()=>{
  const p=prepareRecommendation(request(),knowledge,{now});assert.equal(p.observations.length,3);
  const hidden=prepareRecommendation(request(),knowledge,{now,excludeTaskIds:['merge-patch']});assert.equal(hidden.observations.length,0);assert.equal(hidden.status,'prepared');
});
test('tool-using requests retain guidance without claiming code-only measurements',()=>{
  const r={...request(),executionMode:'tools'},p=prepareRecommendation(r,knowledge,{now});
  assert.equal(p.observations.length,0);assert.equal(finishRecommendation(p,answer(p.payload)).primary.priorAttempts,0);
});
test('user eligibility is respected and separate speed modes are never invented',()=>{
  const r=request();r.constraints={allowedModels:['gpt-6-luna']};r.harness.models.find(m=>m.id==='gpt-6-luna').efforts=['medium'];
  const p=prepareRecommendation(r,knowledge,{now});assert.equal(p.candidates.length,1);assert.equal(p.candidates[0].effort,'medium');
  r.constraints.allowedModels=['absent'];assert.equal(prepareRecommendation(r,knowledge,{now}).status,'no_eligible_option');
});
test('freshness and source provenance fail before network use',()=>{
  const r=request();r.harness.observedAt='2020-01-01T00:00:00Z';assert.equal(prepareRecommendation(r,knowledge,{now}).status,'inventory_stale');
  const stale={...knowledge,expiresAt:new Date(now-1).toISOString()};assert.equal(prepareRecommendation(request(),stale,{now}).status,'knowledge_stale');
  const bad=structuredClone(knowledge);bad.opinions[0].basis=['invented'];assert.throws(()=>validateKnowledge(bad,now),/provenance/);
});
test('invalid distributions and invented configurations are rejected',()=>{
  const p=prepareRecommendation(request(),knowledge,{now});let r=answer(p.payload);r.answers.configuration.choice='invented';assert.throws(()=>finishRecommendation(p,r));
  r=answer(p.payload);r.answers.configuration.probabilities.c0=0.5;assert.throws(()=>finishRecommendation(p,r));
});
for(const scenario of journeys)for(const priority of ['balanced','quality','speed','cost'])test(`production HTTP journey: ${scenario.id}/${priority}`,async t=>{
  let prepared;const f=await fixture(t,{onPrepared:p=>{prepared=p;}});
  const {id,...task}=scenario,result=await recommend({...request(),...task,priority},{endpoint:f.endpoint});
  if(priority==='cost'){assert.equal(result.status,'needs_evidence');assert.equal(f.quota.count(),0);}
  else{assert.equal(result.status,'provisional');assert.equal(prepared.payload.state.task,scenario.task);assert.equal(prepared.candidates.length,40);assert.equal(result.knowledgeVersion,knowledge.version);assert.ok(result.sources.length);assert.equal(f.quota.count(),1);}
});
test('real MCP client initializes, lists tool and calls same advisor',async t=>{
  const f=await fixture(t),client=new Client({name:'contract-test',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp',f.endpoint)));
  t.after(()=>client.close());const list=await client.listTools();assert.equal(list.tools[0].name,'recommend_model');
  const result=await client.callTool({name:'recommend_model',arguments:request()});assert.equal(result.structuredContent.status,'provisional');assert.equal(f.quota.count(),1);
});
test('duplicate in-flight requests and cache hits consume a single provider attempt',async t=>{
  let calls=0;const f=await fixture(t,{fetchImpl:async(u,o)=>{calls++;await new Promise(r=>setTimeout(r,10));return {ok:true,json:async()=>answer(JSON.parse(o.body))};}});
  const results=await Promise.all([recommend(request(),{endpoint:f.endpoint}),recommend(request(),{endpoint:f.endpoint})]);
  assert.equal(calls,1);assert.deepEqual(results[0].primary,results[1].primary);
  assert.equal((await recommend(request(),{endpoint:f.endpoint})).cached,true);assert.equal(f.quota.count(),1);
});
test('HTTP 429 counts once, persists cooldown and never retries or leaks provider errors',async t=>{
  let calls=0;const f=await fixture(t,{fetchImpl:async()=>{calls++;return {ok:false,status:429};}});
  const result=await recommend(request(),{endpoint:f.endpoint});assert.equal(result.status,'temporarily_unavailable');assert.equal(calls,1);assert.equal(f.quota.count(),1);
  const next=await recommend({...request(),task:'A distinct task summary.'},{endpoint:f.endpoint});assert.equal(next.reason,'provider_cooldown');assert.equal(calls,1);
  const stored=await readFile(join(f.dir,'quota.sqlite'));assert.ok(!stored.includes(Buffer.from(request().task)));assert.ok(!JSON.stringify(result).includes('synthetic-test-secret'));
});
test('global cap survives restart and concurrent connections',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'advisor-quota-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const path=join(dir,'quota.sqlite'),a=new Quota(path,{dailyLimit:2,now:()=>now}),b=new Quota(path,{dailyLimit:2,now:()=>now});
  assert.equal(a.reserve().allowed,true);assert.equal(b.reserve().allowed,true);assert.equal(a.reserve().allowed,false);a.close();b.close();
  const restarted=new Quota(path,{dailyLimit:2,now:()=>now});assert.equal(restarted.count(),2);assert.equal(restarted.reserve().allowed,false);restarted.close();
  assert.throws(()=>new Quota(undefined,{dailyLimit:1}),/persistent/);
});
test('invalid request, cross-origin access and non-HTTPS client do not reach provider',async t=>{
  const f=await fixture(t);const invalid=await fetch(f.endpoint+'/v1/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request(),apiKey:'do-not-accept'})});assert.equal(invalid.status,400);
  const cross=await fetch(f.endpoint+'/v1/recommend',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify(request())});assert.equal(cross.status,403);
  assert.equal(f.quota.count(),0);await assert.rejects(recommend(request(),{endpoint:'http://example.com'}),/HTTPS/);
});
