import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tasks,publicTask } from '../evals/suite/catalog.mjs';
import { grade,validateSuite } from '../evals/suite/grade.mjs';
import { buildPayload,validResearch,outcomeMetrics,wilson } from '../evals/suite/payloads.mjs';
import {verifySeal} from '../evals/suite/release.mjs';
const research=JSON.parse(await readFile(new URL('../evals/suite/research.json',import.meta.url),'utf8'));
const configs=[{model:'a',effort:'low',speed:null},{model:'b',effort:'high',speed:null}];
const records=['x','y'].flatMap((taskId,i)=>configs.map(configuration=>({taskId,family:'different-'+i,split:'development',configuration,status:'graded',repeat:0,grade:{passed:true},latencyMs:100+i})));
const task=tasks[0];
const options={task,records,configurations:configs,priority:'quality',variant:'v2-research-opinion',research,now:Date.parse(research.reviewedAt)+1000};
for(const t of tasks)test(`independent control and counterexamples: ${t.id}`,()=>{
  assert.equal(grade(t,t.reference).passed,true);
  assert.equal(grade(t,'export function solve(){return null;}').passed,false);
  assert.equal(grade(t,`export function solve(){return ${JSON.stringify(t.cases[0].expected)};}`).passed,false);
});
test('entire family stays in one split and private graders do not enter task prompt',()=>{
  assert.equal(validateSuite().tasks,36);
  for(const t of tasks)assert.deepEqual(Object.keys(publicTask(t)).sort(),['difficulty','family','id','prompt','starter']);
});
test('correct output that mutates input is rejected',()=>{
  const t=tasks.find(t=>t.id==='normalize-path');
  const custom={...t,cases:[{input:[1],expected:2}]};
  assert.equal(grade(custom,'export function solve(a){a.push(2);return 2;}').passed,false);
});
test('prototype-looking input keys retain their literal JSON meaning',()=>{
  const t=tasks.find(t=>t.id==='merge-patch');
  assert.equal(grade(t,t.reference).passed,true);
});
test('same task, related family, selection and held-out measurements are excluded from payload',()=>{
  const extra=[{...records[0],taskId:task.id,family:'other'},{...records[0],taskId:'related',family:task.family},{...records[0],split:'heldout'},{...records[0],split:'selection'}];
  const p=buildPayload({...options,records:[...records,...extra]});
  assert.equal(p.candidates[0].summary.attempts,2);assert.equal(p.candidates[1].summary.attempts,2);
  assert.ok(!JSON.stringify(p.payload).includes('related'));
});
test('no evidence causes abstention before any provider call',()=>{
  assert.equal(buildPayload({...options,records:[]}).status,'needs_evidence');
});
test('cost unknown remains unknown rather than zero',()=>{
  assert.equal(buildPayload({...options,priority:'cost'}).status,'needs_evidence');
});
test('research revisions are an actual payload ablation',()=>{
  const v0=buildPayload({...options,variant:'v0-measured'}).payload.state;
  const v1=buildPayload({...options,variant:'v1-task-rubric'}).payload.state;
  const v2=buildPayload(options).payload.state;
  assert.equal(v0.taskRubric,undefined);assert.ok(v1.taskRubric);assert.equal(v1.research,undefined);assert.ok(v2.research.opinions.length);
});
test('expired research and invented evidence citations cannot enter opinion variant',()=>{
  assert.throws(()=>buildPayload({...options,now:Date.parse(research.reviewBy)+1}),/stale/);
  const r=structuredClone(research);r.opinions[0].basis=['invented'];assert.throws(()=>validResearch(r,options.now),/valid sources/);
  r.opinions[0].basis=research.opinions[0].basis;r.opinions[0].isMeasurement=true;assert.throws(()=>validResearch(r,options.now),/labeled/);
});
test('execution failures stay in quality denominator and latency observations',()=>{
  const rs=[...records,{...records[0],taskId:'z',family:'third',status:'execution_failed',grade:null,latencyMs:999}];
  const c=buildPayload({...options,records:rs}).candidates[0];
  assert.equal(c.summary.attempts,3);assert.equal(c.summary.passed,2);assert.equal(c.metrics.latencyMs,101);
});
test('abstentions do not inflate reported outcome success',()=>{
  const rs=[{taskId:'x',configuration:configs[0],grade:{passed:true},latencyMs:100}];
  const m=outcomeMetrics([{taskId:'x',result:{status:'needs_evidence'}}],rs);
  assert.equal(m.coverage,0);assert.equal(m.successRateIncludingAbstentions,0);assert.equal(m.missedSolvable,1);
});
test('one successful observation does not imply reliable success probability',()=>{
  const [low,high]=wilson(1,1);assert.ok(low<0.3);assert.ok(high<=1);
});
test('all repeated outcomes count rather than only the first successful run',()=>{
  const rs=[true,false,false].map((passed,repeat)=>({taskId:'x',configuration:configs[0],status:'graded',repeat,grade:{passed},latencyMs:100+repeat}));
  const m=outcomeMetrics([{taskId:'x',result:{status:'provisional',primary:configs[0]}}],rs);
  assert.equal(m.selectedAttempts,3);assert.equal(m.successes,1);assert.equal(m.successRateIncludingAbstentions,1/3);assert.equal(m.medianSelectedLatencyMs,101);
  assert.deepEqual(outcomeMetrics([{taskId:'x',result:{status:'provisional',primary:configs[0]}}],rs.toReversed()),m);
});
test('provider failure is separate from a deliberate abstention',()=>{
  const m=outcomeMetrics([{taskId:'x',error:'HTTP 429'}],records);
  assert.equal(m.providerErrors,1);assert.equal(m.abstained,0);assert.equal(m.coverage,0);
});
test('oversized payload is rejected before provider access',()=>{
  assert.throws(()=>buildPayload({...options,task:{...task,description:'x'.repeat(17000)}}),/16 KB/);
});
test('held-out release refuses changed payload, research, or suite',()=>{
  const current={suiteHash:'s',payloadHash:'p',researchHash:'r'};
  const seal={...current,variant:'v1-task-rubric',selectionReportHash:'selection',reason:'selected before held-out results'};
  verifySeal(seal,current);
  for(const key of Object.keys(current))assert.throws(()=>verifySeal({...seal,[key]:'changed'},current),/Frozen release changed/);
});
