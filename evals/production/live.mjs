// Bounded real decision-path experiment; no coding turns. Uses only synthetic tasks.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {join,resolve} from 'node:path';
import {createAdvisor,createHttpServer} from '../../service/app.mjs';
import {Quota} from '../../service/quota.mjs';
import {recommend} from '../../plugins/model-advisor/src/hosted-client.mjs';
import {journeys} from './cases.mjs';
const {values}=parseArgs({options:{live:{type:'boolean',default:false}}});
const selected=['small-edit','parser-bug','merge-patch-new','frontend','migration','architecture'].map((id,i)=>({...journeys.find(j=>j.id===id),priority:['balanced','quality','speed'][i%3]}));
console.log(JSON.stringify({plannedLiquidCalls:selected.length,codingCalls:0,mode:'packaged-client-to-service-to-liquid',syntheticOnly:true}));
if(!values.live)process.exit(0);
const previous=JSON.parse(await readFile('evals/runs/suite-2026-10-10T01-43-00.906Z/comparison.json','utf8'));
if(previous.attempted+selected.length>36)throw Error('Original authorization limit exceeded');
const dir=resolve('evals/runs/production-path-2026-10-10');await mkdir(dir,{recursive:true});
const receipt={status:'running',priorLiquidAttempts:previous.attempted,authorizedCombinedMaximum:36,attempted:0,results:[]};
const output=join(dir,'receipt.json');await writeFile(output,JSON.stringify(receipt,null,2),{flag:'wx'});
const knowledge=JSON.parse(await readFile('knowledge/current.json','utf8'));
const inventory=JSON.parse(await readFile('data/inventory.local.json','utf8'));
const quota=new Quota(join(dir,'quota.sqlite'),{dailyLimit:6});
let current;
const advisor=createAdvisor({knowledge,quota,apiKey:process.env.LIQUID_API_KEY,onPrepared:p=>{current.payload=p.payload;current.payloadHash=p.payloadHash;}});
const server=createHttpServer({advisor,knowledge});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const endpoint=`http://127.0.0.1:${server.address().port}`;
try{
  for(const [i,scenario]of selected.entries()){
    if(i)await new Promise(r=>setTimeout(r,20000));
    const {id,...task}=scenario;
    const request={...task,harness:{id:'codex',version:inventory.cliVersion,accessType:inventory.accessType,observedAt:inventory.observedAt,models:inventory.models.map(m=>({id:m.id,efforts:m.efforts,speedModes:m.speedModes??null}))}};
    current={id,request};receipt.results.push(current);receipt.attempted++;await writeFile(output,JSON.stringify(receipt,null,2));
    current.result=await recommend(request,{endpoint});await writeFile(output,JSON.stringify(receipt,null,2));
    console.log(JSON.stringify({id,status:current.result.status,primary:current.result.primary,reason:current.result.reason}));
    if(current.result.status==='temporarily_unavailable'){receipt.status='stopped-on-provider-failure';break;}
  }
  if(receipt.status==='running')receipt.status='completed';
}finally{receipt.finishedAt=new Date().toISOString();receipt.providerCalls=quota.count();await writeFile(output,JSON.stringify(receipt,null,2)+'\n');server.closeAllConnections();await new Promise(r=>server.close(r));quota.close();console.log(JSON.stringify({receipt:output,status:receipt.status,providerCalls:receipt.providerCalls}));}
