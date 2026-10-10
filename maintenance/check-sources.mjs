import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const allowed=new Set(['learn.chatgpt.com','developers.openai.com','docs.liquid.ai']);
export async function checkSources(sources,previous,{fetchImpl=fetch,now=()=>new Date().toISOString()}={}){
  const entries=[];
  for(const source of sources){
    const url=new URL(source.url);if(url.protocol!=='https:'||!allowed.has(url.hostname)||url.username||url.password)throw Error('Source URL is not allowlisted');
    try{
      const response=await fetchImpl(url,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Accept:'text/markdown,text/plain'}});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;if(bytes>2000000)throw Error('Source exceeds byte bound');chunks.push(chunk);}
      const content=Buffer.concat(chunks).toString('utf8').replace(/\r\n/g,'\n').trim();
      if(content.length<100)throw Error('Source response unexpectedly short');
      const hash=createHash('sha256').update(content).digest('hex'),prior=previous?.entries?.find(e=>e.id===source.id);
      entries.push({...source,hash,status:prior?.hash===hash?'unchanged':'review_required'});
    }catch(e){entries.push({...source,status:'fetch_failed',reason:String(e.message).slice(0,100)});}
  }
  return {checkedAt:now(),entries,needsReview:entries.some(e=>e.status==='review_required'),failed:entries.some(e=>e.status==='fetch_failed'),interpretation:'A content change requires research review. This checker never updates model facts, prices, opinions or knowledge freshness.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const sources=JSON.parse(await readFile('maintenance/sources.json','utf8'));
  let previous=null;try{previous=JSON.parse(await readFile('maintenance/reviewed-sources.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const result=await checkSources(sources,previous);await mkdir('data',{recursive:true});await writeFile('data/source-check.local.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));if(result.failed)process.exitCode=1;
}
