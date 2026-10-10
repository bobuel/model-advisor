import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const config={features:{apps:false,plugins:false,memories:false,multi_agent:false,hooks:false,shell_tool:false,image_generation:false,in_app_browser:false,computer_use:false},mcp_servers:{},web_search:'disabled',project_doc_max_bytes:0};
const toml=v=>v&&typeof v==='object'?'{'+Object.entries(v).map(([k,x])=>`${JSON.stringify(k)}=${toml(x)}`).join(',')+'}':JSON.stringify(v);
export class CandidateClient{
  constructor(){
    const env={...process.env};for(const k of Object.keys(env))if(/(?:API_KEY|SECRET|TOKEN)$/i.test(k))delete env[k];
    this.pending=new Map();this.events=[];this.sequence=0;this.completion=null;
    this.child=spawn(process.platform==='win32'?'codex.exe':'codex',[...Object.entries(config).flatMap(([k,v])=>['-c',`${k}=${toml(v)}`]),'app-server','--listen','stdio://'],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.stderr.resume();this.lines=createInterface({input:this.child.stdout});
    this.lines.on('line',line=>{let m;try{m=JSON.parse(line);}catch{return;}
      if(m.id!=null&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error('RPC failed: '+JSON.stringify(m.error))):p.resolve(m.result);return;}
      if(m.method){this.events.push(m);if(m.method==='turn/completed'&&this.completion?.threadId===m.params.threadId)this.completion.resolve(m.params);}
      if(m.id!=null&&m.method)this.send({id:m.id,error:{code:-32601,message:'Tools and approvals disabled for evaluation'}});
    });
    this.child.on('error',()=>this.fail(Error('Could not start Codex')));
    this.child.on('exit',()=>this.fail(Error('Codex exited before response')));
  }
  send(value){this.child.stdin.write(JSON.stringify(value)+'\n');}
  fail(e){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e);}this.pending.clear();this.completion?.reject(e);}
  call(method,params){return new Promise((resolve,reject)=>{const id=++this.sequence,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('RPC timed out: '+method));},25000);this.pending.set(id,{resolve,reject,timer});this.send({id,method,params});});}
  async initialize(){await this.call('initialize',{clientInfo:{name:'advisor_eval_suite',version:'1'},capabilities:{experimentalApi:true}});this.send({method:'initialized',params:{}});const a=await this.call('account/read',{refreshToken:false});if(a.account?.type!=='chatgpt')throw Error('Existing ChatGPT subscription required; API-key fallback disabled');}
  async generate(configuration,task,folder){
    this.events=[];
    const start=await this.call('thread/start',{model:configuration.model,modelProvider:'openai',allowProviderModelFallback:false,ephemeral:true,environments:[],dynamicTools:[],sandbox:'read-only',approvalPolicy:'never',cwd:folder,runtimeWorkspaceRoots:[],config:{...config,model_reasoning_effort:configuration.effort,service_tier:'default'},developerInstructions:'Code-only evaluation. Environment access is disabled. Solve only the supplied task without tools. Return JSON containing code and explanation.'});
    if(start.model!==configuration.model||start.reasoningEffort!==configuration.effort)throw Error('Requested settings were not resolved');
    let timer;const done=new Promise((resolve,reject)=>{this.completion={threadId:start.thread.id,resolve,reject};timer=setTimeout(()=>reject(Error('Candidate timeout after 180 seconds')),180000);});
    // Attach a handler immediately so a slow turn/start cannot produce an unhandled rejection.
    done.catch(()=>{});const now=performance.now();
    try{
      await this.call('turn/start',{threadId:start.thread.id,environments:[],model:configuration.model,effort:configuration.effort,serviceTierForTurn:'default',input:[{type:'text',text:task.prompt+'\nStarter module:\n'+task.starter}],outputSchema:{type:'object',additionalProperties:false,properties:{code:{type:'string'},explanation:{type:'string'}},required:['code','explanation']}});
      const completed=await done,trace=this.events.filter(e=>e.params?.threadId===start.thread.id);
      const items=trace.filter(e=>e.method==='item/completed').map(e=>e.params.item);
      if(items.some(x=>!['agentMessage','reasoning','userMessage','plan'].includes(x.type)))throw Error('Unexpected tool activity');
      const output=JSON.parse(items.filter(x=>x.type==='agentMessage').at(-1)?.text??'null');
      if(completed.turn.status!=='completed'||typeof output?.code!=='string')throw Error('No completed code response');
      return {output,trace,latencyMs:Math.round(performance.now()-now),runtimeObserved:{model:start.model,effort:start.reasoningEffort,speed:start.serviceTier},usage:trace.findLast(e=>e.method==='thread/tokenUsage/updated')?.params.tokenUsage??null};
    }finally{clearTimeout(timer);this.completion=null;}
  }
  close(){this.fail(Error('Evaluation client closed'));this.lines.close();this.child.stdin.end();this.child.kill();}
}
