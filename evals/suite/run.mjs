import { parseArgs } from 'node:util';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tasks,publicTask,suiteVersion } from './catalog.mjs';
import { suiteHash,hash } from './grade.mjs';
import { CandidateClient } from './client.mjs';
import { releaseHashes,verifySeal } from './release.mjs';
const {values}=parseArgs({options:{live:{type:'boolean',default:false},split:{type:'string',default:'development'},repetitions:{type:'string',default:'1'},'max-calls':{type:'string',default:'18'},cohort:{type:'string',default:'first-batch'},'release-seal':{type:'string'}}});
const root=resolve(import.meta.dirname,'../..');
const request=JSON.parse(await readFile(join(root,'plugins/model-advisor/examples/bug-fix-request.json'),'utf8'));
const configurations=request.configurations;
const selected=tasks.filter(t=>t.split===values.split&&(values.cohort==='all'||t.difficulty==='medium'));
if(!['development','selection','heldout'].includes(values.split)||!['all','first-batch'].includes(values.cohort))throw Error('Invalid split/cohort');
const repetitions=Number(values.repetitions),cap=Number(values['max-calls']);
if(!Number.isInteger(repetitions)||repetitions<1||repetitions>10||!Number.isInteger(cap)||cap<1)throw Error('Invalid run budget');
const jobs=[];for(let r=0;r<repetitions;r++)for(const[i,t]of selected.entries())for(let j=0;j<configurations.length;j++)jobs.push({task:t,configuration:configurations[(i+j+r)%configurations.length],repeat:r});
const plan={suiteVersion,suiteHash,split:values.split,cohort:values.cohort,tasks:selected.length,configurations:configurations.length,repetitions,codingCalls:jobs.length,maxCalls:cap,mode:'codex-code-only-v1',costUsd:null};
console.log(JSON.stringify(plan));if(!values.live)process.exit(0);
if(jobs.length>cap)throw Error('Plan exceeds approved coding-call cap');
if(values.split==='heldout'&&!values['release-seal'])throw Error('Held-out runs require a frozen payload release seal');
if(values['release-seal'])verifySeal(JSON.parse(await readFile(values['release-seal'],'utf8')),await releaseHashes());
const inventory=JSON.parse(await readFile(join(root,'data/inventory.local.json'),'utf8'));
const cliVersion=execFileSync(process.platform==='win32'?'codex.exe':'codex',['--version'],{encoding:'utf8',windowsHide:true}).trim();
if(inventory.accessType!=='chatgpt'||inventory.cliVersion!==cliVersion||Date.now()-Date.parse(inventory.observedAt)>86400000)throw Error('Refresh subscription inventory before running');
for(const c of configurations)if(c.speed!==null||!inventory.models.find(m=>m.id===c.model)?.efforts.includes(c.effort))throw Error('Unobserved configuration');
const runRoot=join(root,'evals/runs','suite-'+new Date().toISOString().replaceAll(':','-'));await mkdir(runRoot,{recursive:true});
const ledger={...plan,cliVersion,accessType:'chatgpt',startedAt:new Date().toISOString(),attempted:0,records:[]};
const save=()=>writeFile(join(runRoot,'ledger.json'),JSON.stringify(ledger,null,2)+'\n');await save();
const client=new CandidateClient();
try{await client.initialize();for(const[jobIndex,job]of jobs.entries()){
  const folder=join(runRoot,String(jobIndex).padStart(3,'0'));await mkdir(folder);
  const visible=publicTask(job.task),record={jobIndex,taskId:job.task.id,family:job.task.family,difficulty:job.task.difficulty,split:job.task.split,configuration:job.configuration,repeat:job.repeat,promptHash:hash(visible),folder,status:'started',startedAt:new Date().toISOString()};
  ledger.attempted++;ledger.records.push(record);await save();await writeFile(join(folder,'prompt.json'),JSON.stringify(visible,null,2));
  console.log(JSON.stringify({running:jobIndex+1,total:jobs.length,task:job.task.id,configuration:job.configuration}));
  const clock=performance.now();
  try{const result=await client.generate(job.configuration,visible,folder);await writeFile(join(folder,'candidate.mjs'),result.output.code);await writeFile(join(folder,'events.jsonl'),result.trace.map(x=>JSON.stringify(x)).join('\n')+'\n');Object.assign(record,{status:'generated',sourceHash:hash(result.output.code),latencyMs:result.latencyMs,runtimeObserved:result.runtimeObserved,usage:result.usage,toolCalls:0});}
  catch(error){Object.assign(record,{status:'execution_failed',latencyMs:Math.round(performance.now()-clock),error:String(error.message).slice(0,400)});await save();console.log(JSON.stringify({failed:record.taskId,reason:record.error}));break;}
  record.completedAt=new Date().toISOString();await save();console.log(JSON.stringify({completed:jobIndex+1,latencyMs:record.latencyMs}));
}}finally{client.close();ledger.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({runRoot,attempted:ledger.attempted,planned:jobs.length}));}
