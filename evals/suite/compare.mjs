import { readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { parseArgs } from 'node:util';
import { tasks } from './catalog.mjs';
import { suiteHash,hash } from './grade.mjs';
import { variants,buildPayload,outcomeMetrics,median } from './payloads.mjs';
import { evaluate,configKey } from '../../plugins/model-advisor/src/advisor.mjs';
import {releaseHashes,verifySeal} from './release.mjs';
const {values}=parseArgs({options:{run:{type:'string'},live:{type:'boolean',default:false},'max-calls':{type:'string',default:'36'},'continue-unattempted':{type:'boolean',default:false},'delay-ms':{type:'string',default:'10000'},'development-run':{type:'string'},'release-seal':{type:'string'}}});
if(!values.run)throw Error('Supply --run <suite-run-directory>');
const directory=resolve(values.run),ledger=JSON.parse(await readFile(join(directory,'ledger.json'),'utf8'));
if(ledger.suiteHash!==suiteHash)throw Error('Suite changed since generation');
if(ledger.records.length!==ledger.codingCalls||ledger.records.some(r=>!['graded','execution_failed'].includes(r.status)))throw Error('Review and grade the entire planned coding cohort first');
const development=values['development-run']?JSON.parse(await readFile(join(resolve(values['development-run']),'ledger.json'),'utf8')):ledger;
if(development.split!=='development'||development.suiteHash!==suiteHash||development.cliVersion!==ledger.cliVersion||development.mode!==ledger.mode||development.accessType!==ledger.accessType||development.records.some(r=>!['graded','execution_failed'].includes(r.status)))throw Error('Provide compatible, reviewed development evidence; never use selection or held-out outcomes as input');
let chosenVariants=variants;
const currentRelease=await releaseHashes();
if(ledger.split==='heldout'){
  if(!values['release-seal'])throw Error('Held-out comparison requires frozen release seal');
  const seal=JSON.parse(await readFile(values['release-seal'],'utf8'));verifySeal(seal,currentRelease);chosenVariants=[seal.variant];
}
const research=JSON.parse(await readFile(new URL('./research.json',import.meta.url),'utf8'));
const configurations=[...new Map(ledger.records.map(r=>[configKey(r.configuration),r.configuration])).values()];
const ids=[...new Set(ledger.records.map(r=>r.taskId))];
const comparisons=[];for(const taskId of ids)for(const priority of ['quality','speed'])for(const variant of chosenVariants){const prepared=buildPayload({task:tasks.find(t=>t.id===taskId),records:development.records,configurations,priority,variant,research});comparisons.push({taskId,priority,variant,prepared,payloadHash:hash(prepared.payload??prepared)});}
const planned=comparisons.filter(x=>x.prepared.status==='prepared').length,cap=Number(values['max-calls']);
console.log(JSON.stringify({plannedLiquidCalls:planned,cap,variants:chosenVariants,priorities:['quality','speed'],researchVersion:research.version,split:ledger.split}));
if(!values.live)process.exit(0);
if(!Number.isInteger(cap)||planned>cap||cap<1)throw Error('Comparison exceeds approved call budget');
const path=join(directory,'comparison.json');
let previous=null;try{previous=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(previous&&!values['continue-unattempted'])throw Error('Comparison already exists; explicit --continue-unattempted is required');
if(previous&&(previous.suiteHash!==suiteHash||previous.researchHash!==hash(research)||previous.planned!==planned))throw Error('Experiment changed; cannot continue');
const state=previous??{...currentRelease,split:ledger.split,developmentLedgerHash:hash(development),variants:chosenVariants,startedAt:new Date().toISOString(),planned,attempted:0,decisions:[],status:'running'};
const delay=Number(values['delay-ms']);if(!Number.isInteger(delay)||delay<10000||delay>60000)throw Error('Use 10000–60000 ms pacing');
const save=()=>writeFile(path,JSON.stringify(state,null,2)+'\n');await save();
for(const item of comparisons){
  const existing=state.decisions.find(x=>x.taskId===item.taskId&&x.priority===item.priority&&x.variant===item.variant);
  if(existing){if(existing.payloadHash!==item.payloadHash)throw Error('Payload changed; cannot continue');continue;}
  if(state.attempted>=cap)throw Error('Persisted call cap reached');
  if(state.attempted)await new Promise(resolve=>setTimeout(resolve,delay));
  const record={taskId:item.taskId,priority:item.priority,variant:item.variant,payloadHash:item.payloadHash,payload:item.prepared.payload??null};state.decisions.push(record);
  if(item.prepared.status==='prepared')state.attempted++;
  await save();const start=performance.now();
  try{record.result=await evaluate(item.prepared,{apiKey:process.env.LIQUID_API_KEY});record.durationMs=Math.round(performance.now()-start);}
  catch(e){record.error=e.message;state.status='stopped-on-error';await save();throw e;}
  await save();console.log(JSON.stringify({decision:state.decisions.length,taskId:item.taskId,priority:item.priority,variant:item.variant,status:record.result.status,model:record.result.primary?.model}));
}
state.metrics={};
for(const priority of ['quality','speed'])for(const variant of chosenVariants)state.metrics[`${priority}:${variant}`]=outcomeMetrics(state.decisions.filter(x=>x.priority===priority&&x.variant===variant),ledger.records);
const baseline=mode=>ids.map(taskId=>{const target=tasks.find(t=>t.id===taskId);const candidates=configurations.map(configuration=>{const donor=development.records.filter(r=>r.taskId!==taskId&&r.family!==target.family&&configKey(r.configuration)===configKey(configuration));return {configuration,passRate:donor.length?donor.filter(r=>r.grade?.passed).length/donor.length:0,latency:median(donor.map(r=>r.latencyMs))};});const c=mode==='default'?configurations.find(c=>c.model==='gpt-6-astra'):candidates.sort((a,b)=>b.passRate-a.passRate||a.latency-b.latency)[0].configuration;return {taskId,result:{status:'provisional',primary:c}};});
state.baselines={alwaysAstra:outcomeMetrics(baseline('default'),ledger.records),bestDevelopmentQualityThenSpeed:outcomeMetrics(baseline('measured'),ledger.records)};
state.status=state.decisions.some(x=>x.error||!x.result)?'completed-with-errors':'completed';state.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({path,metrics:state.metrics,baselines:state.baselines},null,2));
