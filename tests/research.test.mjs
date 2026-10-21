import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BaseChatModel} from '@langchain/core/language_models/chat_models';
import {AIMessage} from '@langchain/core/messages';
import {runResearch,sourceUrl,fetchSource} from '../maintenance/research-agent.mjs';
import {researchHash,validateResearch,validatePublishedResearch} from '../service/research.mjs';
import {prepareRecommendation,finishRecommendation} from '../service/recommend.mjs';

const k=JSON.parse(await readFile(new URL('../knowledge/current.json',import.meta.url),'utf8'));
const now=Date.parse(k.reviewedAt)+1000;
class ScriptedModel extends BaseChatModel{
  constructor(responses){super({});this.responses=responses;this.calls=0;this.offered=[];}
  _llmType(){return 'research-test';}
  bindTools(tools){this.offered.push(tools.map(t=>t.name));return this;}
  async _generate(){const message=this.responses[this.calls++]??new AIMessage('Done');return {generations:[{text:'',message}]};}
}
const call=(name,args,id=name)=>new AIMessage({content:'',tool_calls:[{name,args,id,type:'tool_call'}]});
const finding=()=>({...structuredClone(k.research.findings[0]),citations:[{sourceId:'source-1',section:'Model guidance'}]});
const read=()=>call('read_source',{url:'https://learn.chatgpt.com/docs/models.md'});
const submit=(f=finding())=>call('submit_findings',{findings:[f],gaps:['Independent comparative evidence missing.']});
const response=()=>new Response('# Model guidance\nSol suits complex coding.',{headers:{'content-type':'text/markdown'}});
const options=model=>({model,search:async()=>[{url:'https://learn.chatgpt.com/docs/models.md',title:'Official guidance'}],fetchImpl:async()=>response(),question:'Research model fit and effort for Codex.',now:()=>now});

test('actual LangChain graph discovers, reads, cites and returns an unapproved draft',async()=>{
  const model=new ScriptedModel([call('web_search',{query:'official Codex model guidance'}),read(),submit(),new AIMessage('Draft ready')]);
  const r=await runResearch(options(model));
  assert.equal(r.draft.findings[0].citations[0].sourceId,r.draft.sources[0].id);
  assert.deepEqual(r.counts,{modelCalls:4,searches:1,fetches:1});
  assert.equal(r.draft.review,undefined);assert.throws(()=>validatePublishedResearch(r.draft,{now}),/separate review/);
  assert.ok(model.offered.flat().includes('read_source'));
  assert.ok(!model.offered.flat().some(name=>['task','glob','grep','read_file','write_file','execute'].includes(name)));
});
test('graph cannot promote a fabricated citation',async()=>{
  const f=finding();f.citations[0].sourceId='invented';
  await assert.rejects(runResearch(options(new ScriptedModel([read(),submit(f)]))),/citation|valid draft/i);
});
test('graph never defaults to a paid provider or accepts provider names',async()=>{
  await assert.rejects(runResearch({question:'Research models'}),/Explicit authorized/);
  await assert.rejects(runResearch({...options('default')}),/Explicit authorized/);
});
test('source fetch denies private hosts, redirects and oversized documents',async()=>{
  for(const url of ['http://openai.com','https://127.0.0.1','https://evil.example','https://openai.com.evil.example','https://user:pass@openai.com','https://github.com/random/repo'])assert.throws(()=>sourceUrl(url));
  let redirect;
  await fetchSource('https://openai.com',{fetchImpl:async(url,o)=>{redirect=o.redirect;return response();}});assert.equal(redirect,'error');
  await assert.rejects(fetchSource('https://openai.com',{fetchImpl:async()=>new Response('x'.repeat(200001),{headers:{'content-type':'text/plain'}})}),/size limit/);
});
test('graph does not execute injected filesystem or delegation tool calls',async()=>{
  for(const name of ['write_file','glob','task']){
    await assert.rejects(runResearch(options(new ScriptedModel([call(name,{file_path:'/stolen',content:'x',pattern:'{'.repeat(2000),description:'delegate'})]))),/denied|valid draft|not found|not a valid tool/i);
  }
});
test('graph model budget prevents an endless planning loop',async()=>{
  const model=new ScriptedModel(Array.from({length:15},(_,i)=>call('write_todos',{todos:[{content:'Check evidence',status:'in_progress'}]},`plan-${i}`)));
  await assert.rejects(runResearch(options(model)),/Model budget exhausted/);assert.equal(model.calls,12);
});
test('separate runs have separate source ledgers and budgets',async()=>{
  for(let i=0;i<2;i++){
    const r=await runResearch(options(new ScriptedModel([read(),submit()])));
    assert.equal(r.draft.sources.length,1);assert.equal(r.counts.fetches,1);
  }
});
test('publication rejects unreviewed, altered, stale and unfetched research',()=>{
  const report=structuredClone(k.research),{review,...draft}=report;
  assert.equal(review.draftHash,researchHash(draft));
  assert.throws(()=>validateResearch(draft,{now,ledger:[]}),/not fetched/);
  assert.throws(()=>validatePublishedResearch({...draft},{now}),/separate review/);
  report.findings[0].statement='A new unreviewed claim';assert.throws(()=>validatePublishedResearch(report,{now}),/separate review/);
  assert.throws(()=>validatePublishedResearch(k.research,{now:Date.parse(k.research.expiresAt)+1}),/stale/);
});
test('production payload carries researched effort and returns source-linked advice',()=>{
  const request={task:'Implement a focused parser.',taskCategory:'parsing',priority:'speed',harness:{id:'codex',version:'test',accessType:'chatgpt',observedAt:new Date(now).toISOString(),models:[{id:'gpt-6-luna',efforts:['high'],speedModes:null}]}};
  const p=prepareRecommendation(request,k,{now});
  assert.ok(p.payload.state.research.findings.some(f=>f.statement.includes('Luna high')));
  const r=finishRecommendation(p,{model:'d1:free',answers:{configuration:{type:'choice',choice:'c0',confidence:1,probabilities:{c0:1,insufficient:0}}}});
  assert.equal(r.status,'provisional');assert.equal(r.primary.priorAttempts,0);assert.ok(r.primary.research.length);
  assert.ok(r.sources.some(s=>s.contentHash));
});

test('Luna request excludes Ultra even when supplied by an inconsistent harness',()=>{
  const request={task:'Review a difficult parser.',taskCategory:'parsing',priority:'quality',harness:{id:'codex',version:'test',accessType:'chatgpt',observedAt:new Date(now).toISOString(),models:[{id:'gpt-6-luna',efforts:['max','ultra'],speedModes:null}]}};
  const p=prepareRecommendation(request,k,{now});
  assert.deepEqual(p.candidates.map(c=>c.effort),['max']);
  assert.ok(!p.findings.some(f=>f.id==='effort-ultra'));
  assert.ok(p.findings.some(f=>f.limitations.some(l=>l.includes('not Ultra'))));
  request.harness.models[0].efforts=['ultra'];
  assert.equal(prepareRecommendation(request,k,{now}).status,'no_eligible_option');
});

test('published research matches the separately reviewed source ledger',async()=>{
  const ledger=JSON.parse(await readFile(new URL('../maintenance/reviewed-sources.json',import.meta.url),'utf8'));
  const {review,...draft}=k.research;
  validateResearch(draft,{now,ledger:ledger.entries});
  assert.equal(review.draftHash,ledger.draftHash);
  assert.equal(k.version,ledger.knowledgeVersion);
});
