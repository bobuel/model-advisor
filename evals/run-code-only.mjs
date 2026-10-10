import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const runRoot=join(root,'evals/runs','code-only-'+new Date().toISOString().replaceAll(':','-'));
await mkdir(runRoot,{recursive:true});
const request=JSON.parse(await readFile(join(root,'plugins/model-advisor/examples/bug-fix-request.json'),'utf8'));
const task=await readFile(join(root,'evals/fixtures/merge-intervals/TASK.md'),'utf8');
const source=await readFile(join(root,'evals/fixtures/merge-intervals/intervals.mjs'),'utf8');
const cliVersion=execFileSync('codex.exe',['--version'],{encoding:'utf8',windowsHide:true}).trim();
const env={...process.env};
for(const key of ['OPENAI_API_KEY','CODEX_API_KEY','LIQUID_API_KEY','TYPESAFE_API_KEY','JEV_API_KEY']) delete env[key];
const config={features:{apps:false,plugins:false,memories:false,multi_agent:false,hooks:false,shell_tool:false,image_generation:false,in_app_browser:false,computer_use:false},mcp_servers:{},web_search:'disabled',project_doc_max_bytes:0};
const args=Object.entries(config).flatMap(([k,v])=>['-c',`${k}=${toml(v)}`]);
function toml(v){return v&&typeof v==='object'?'{'+Object.entries(v).map(([k,x])=>`${JSON.stringify(k)}=${toml(x)}`).join(',')+'}':JSON.stringify(v);}
const child=spawn('codex.exe',[...args,'app-server','--listen','stdio://'],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
child.stderr.resume();
const lines=createInterface({input:child.stdout}),pending=new Map(),events=[];
let seq=0,completed=null;
lines.on('line',line=>{
  let message;try{message=JSON.parse(line);}catch{return;}
  if(message.id!=null&&pending.has(message.id)){const p=pending.get(message.id);pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);return;}
  if(message.method){events.push(message);if(message.method==='turn/completed'&&completed) completed(message.params);}
  // No dynamic tools or approvals are accepted by this evaluation client.
  if(message.id!=null&&message.method) child.stdin.write(JSON.stringify({id:message.id,error:{code:-32601,message:'No tools or approvals available in this evaluation'}})+'\n');
});
function call(method,params){return new Promise((resolveCall,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('RPC timeout: '+method));},25000);pending.set(id,{resolve:resolveCall,reject,timer});child.stdin.write(JSON.stringify({id,method,params})+'\n');});}
const results=[];
try{
  await call('initialize',{clientInfo:{name:'advisor_code_only_eval',version:'0.1.0'},capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
  const account=await call('account/read',{refreshToken:false});
  if(account.account?.type!=='chatgpt')throw Error('Subscription authentication required');
  for(const [i,configuration] of request.configurations.entries()){
    const folder=join(runRoot,`c${i}`);await mkdir(folder,{recursive:true});
    const started=await call('thread/start',{model:configuration.model,modelProvider:'openai',allowProviderModelFallback:false,ephemeral:true,environments:[],dynamicTools:[],sandbox:'read-only',approvalPolicy:'never',cwd:folder,runtimeWorkspaceRoots:[],config:{...config,model_reasoning_effort:configuration.effort,service_tier:'default'},developerInstructions:'This is a code-only evaluation. Environment access is disabled. Use only the supplied task and code; return the repaired module in the requested JSON. Do not invoke tools.'});
    if(started.model!==configuration.model||started.reasoningEffort!==configuration.effort) throw Error('Resolved configuration differs from request');
    const prompt=task+'\nThe baseline comment refers to the original fixture. Repair the supplied copy.\n```javascript\n'+source+'\n```\nReturn JSON containing code (the complete corrected ES module) and explanation. No tools are available.';
    await writeFile(join(folder,'invocation.json'),JSON.stringify({cliVersion,configuration,environments:[],runtimeObserved:{model:started.model,effort:started.reasoningEffort,speed:started.serviceTier},prompt},null,2));
    console.log(JSON.stringify({status:'running',configuration,mode:'code-only; environment access disabled'}));
    let turnTimer;
    const completion=new Promise((resolveTurn,reject)=>{completed=resolveTurn;turnTimer=setTimeout(()=>reject(Error('Candidate exceeded 180 seconds')),180000);});
    const start=performance.now();
    await call('turn/start',{threadId:started.thread.id,environments:[],model:configuration.model,effort:configuration.effort,serviceTierForTurn:'default',input:[{type:'text',text:prompt}],outputSchema:{type:'object',additionalProperties:false,properties:{code:{type:'string'},explanation:{type:'string'}},required:['code','explanation']}});
    let done;try{done=await completion;}finally{clearTimeout(turnTimer);completed=null;}
    const durationMs=Math.round(performance.now()-start);
    const trace=events.filter(e=>e.params?.threadId===started.thread.id);
    await writeFile(join(folder,'events.jsonl'),trace.map(e=>JSON.stringify(e)).join('\n')+'\n');
    const items=trace.filter(e=>e.method==='item/completed').map(e=>e.params.item);
    const unexpected=items.filter(x=>!['agentMessage','reasoning','userMessage','plan'].includes(x.type));
    if(unexpected.length)throw Error('Unexpected tool activity; run not accepted');
    const text=items.filter(x=>x.type==='agentMessage').at(-1)?.text;
    const result=text?JSON.parse(text):null;
    if(result?.code)await writeFile(join(folder,'intervals.mjs'),result.code);
    const receipt={observedAt:new Date().toISOString(),configuration,runtimeObserved:{model:started.model,effort:started.reasoningEffort,speed:started.serviceTier},cliVersion,accessType:'chatgpt',harnessMode:'code-only; environment access disabled',fixture:'merge-intervals-v1',turnStatus:done.turn.status,durationMs,usage:trace.findLast(e=>e.method==='thread/tokenUsage/updated')?.params.tokenUsage??null,toolCalls:unexpected.length,explanation:result?.explanation??null,limitations:['One code-only attempt on one task.','Does not validate filesystem tools or the normal desktop harness.','Dollar cost and provider-resolved immutable revision are unknown.']};
    await writeFile(join(folder,'receipt.json'),JSON.stringify(receipt,null,2));results.push({...receipt,folder});
    console.log(JSON.stringify({status:'generated',configuration,turnStatus:receipt.turnStatus,durationMs,toolCalls:receipt.toolCalls}));
  }
}finally{
  for(const p of pending.values())clearTimeout(p.timer);
  await writeFile(join(runRoot,'summary.json'),JSON.stringify({runRoot,results},null,2));
  lines.close();child.stdin.end();child.kill();
  console.log(JSON.stringify({status:'finished',runRoot,completed:results.length}));
}
