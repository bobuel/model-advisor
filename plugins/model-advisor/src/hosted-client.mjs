export async function recommend(request,{endpoint,fetchImpl=fetch}={}){
  const url=new URL(endpoint);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error('Use an HTTPS service endpoint');
  if(url.username||url.password||url.search||url.hash)throw Error('Invalid service endpoint');
  let response;try{response=await fetchImpl(new URL('/v1/recommend',url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(20000),redirect:'error'});}catch{throw Error('Model advisor service is unavailable; no retry was made');}
  if(!response.ok)throw Error(`Model advisor returned HTTP ${response.status}`);
  const result=await response.json();
  if(typeof result.status!=='string')throw Error('Invalid service response');
  return result;
}
