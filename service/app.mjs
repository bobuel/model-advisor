import {createServer} from 'node:http';
import {randomBytes,createHmac} from 'node:crypto';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {prepareRecommendation,finishRecommendation,callDecision,requestSchema,validateKnowledge} from './recommend.mjs';

export function createAdvisor({knowledge,quota,apiKey,fetchImpl=fetch,now=()=>Date.now(),excludeTaskIds=[],onPrepared}={}){
  validateKnowledge(knowledge,now());
  const cache=new Map(),pending=new Map(),salt=randomBytes(32);let active=0;
  return async raw=>{
    const p=prepareRecommendation(raw,knowledge,{now:now(),excludeTaskIds});
    if(p.status!=='prepared')return p;
    const key=createHmac('sha256',salt).update(p.payloadHash).digest('hex');
    const cached=cache.get(key);if(cached&&cached.expires>now())return {...cached.result,cached:true};
    if(pending.has(key))return pending.get(key);
    if(active>=2)return {status:'temporarily_unavailable',reason:'service_busy',knowledgeVersion:knowledge.version};
    if(!apiKey)return {status:'temporarily_unavailable',reason:'provider_not_configured',knowledgeVersion:knowledge.version};
    const reservation=quota.reserve();
    if(!reservation.allowed)return {status:'temporarily_unavailable',reason:reservation.reason,knowledgeVersion:knowledge.version};
    // Reservation is committed before any network request. Timeout still consumes it.
    active++;
    const work=(async()=>{
      try{
        onPrepared?.(p); // Evaluation-only injection. The deployed server supplies no observer.
        const response=await callDecision(p.payload,{apiKey,fetchImpl});
        const result=finishRecommendation(p,response);
        if(cache.size>=128)cache.delete(cache.keys().next().value);
        cache.set(key,{result,expires:now()+300000});return result;
      }catch{
        quota.cooldown();return {status:'temporarily_unavailable',reason:'decision_provider_failed',knowledgeVersion:knowledge.version};
      }finally{active--;pending.delete(key);}
    })();pending.set(key,work);return work;
  };
}
async function body(req){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>32768)throw Error('Request too large');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
export function createHttpServer({advisor,knowledge,revision='local',publicUrl}={}){
  let windowStart=Date.now(),requests=0;
  const expectedHost=publicUrl?new URL(publicUrl).host:null;
  return createServer(async(req,res)=>{
    const path=req.url?.split('?')[0];
    if(expectedHost&&req.headers.host!==expectedHost)return send(res,421,{error:'Unexpected host'});
    if(req.headers.origin&&req.headers.origin!==publicUrl)return send(res,403,{error:'Origin not allowed'});
    if(Date.now()-windowStart>60000){windowStart=Date.now();requests=0;}
    if(++requests>120){res.setHeader('Retry-After','60');return send(res,429,{error:'Request limit reached'});}
    if(req.method==='GET'&&path==='/health')return send(res,200,{status:'ok',revision,knowledgeVersion:knowledge.version,knowledgeHash:validateKnowledge(knowledge).hash,knowledgeStale:validateKnowledge(knowledge).stale});
    if(req.method==='GET'&&path==='/v1/knowledge')return send(res,200,knowledge);
    if(req.method==='GET'&&path==='/')return send(res,200,{name:'Model advisor',status:'public-preview',repository:'https://github.com/bobuel/model-advisor',mcp:'/mcp',privacy:'/privacy',knowledgeVersion:knowledge.version});
    if(req.method==='GET'&&path==='/privacy')return send(res,200,{summary:'Send a short task summary, not private code or credentials. Summaries are processed by this service and Liquid AI. The application does not persist task bodies; an in-memory cache expires after five minutes. Durable quota state contains only dates and counts. Hosting and provider logs are governed by their own policies.',liquid:'https://www.liquid.ai/privacy-policy',repository:'https://github.com/bobuel/model-advisor'});
    if(req.method!=='POST'||!['/v1/recommend','/mcp'].includes(path))return send(res,404,{error:'Not found'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'Use application/json'});
    let input;try{input=await body(req);}catch{return send(res,400,{error:'Invalid or oversized JSON'});}
    if(path==='/v1/recommend'){
      try{return send(res,200,await advisor(input));}catch{return send(res,400,{error:'Invalid recommendation request'});}
    }
    const mcp=new McpServer({name:'model-advisor',version:'0.2.0'});
    mcp.registerTool('recommend_model',{description:'Recommend a supported model and effort for a proposed task and priority using versioned research. Send a short summary, no secrets or private code. No settings are changed. Advice is provisional.',inputSchema:requestSchema.shape,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}},async args=>{
      try{const result=await advisor(args);return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}catch{return {isError:true,content:[{type:'text',text:'Invalid recommendation request'}]};}
    });
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on('close',()=>{void transport.close();void mcp.close();});
    try{await mcp.connect(transport);await transport.handleRequest(req,res,input);}catch{if(!res.headersSent)send(res,500,{error:'MCP request failed'});}
  });
}
